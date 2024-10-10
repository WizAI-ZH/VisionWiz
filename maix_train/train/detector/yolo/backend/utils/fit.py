# -*- coding: utf-8 -*-
import os
import time
import numpy as np



def train(model,
         loss_func,
         train_batch_gen,
         valid_batch_gen,
         learning_rate = 1e-4,
         nb_epoch = 300,
         save_best_weights_path = 'best_weights.h5',
         save_final_weights_path = "final_weights.h5",
         progress_callbacks = []):
    """A function that performs training on a general keras model.

    # Args
        model : tensorflow.keras.models.Model instance
        loss_func : function
            refer to https://keras.io/losses/

        train_batch_gen : tensorflow.keras.utils.Sequence instance
        valid_batch_gen : tensorflow.keras.utils.Sequence instance
        learning_rate : float
        save_best_weights_path : str
    """
    from tensorflow.keras.optimizers import Adam

    # 1. create optimizer
    optimizer = Adam(lr=learning_rate, beta_1=0.9, beta_2=0.999, epsilon=1e-08, decay=0.0)
    
    # 2. create loss function
    model.compile(loss=loss_func,
                  optimizer=optimizer)

    # 4. training
    tflite_path = os.path.splitext(save_final_weights_path)[0]+".tflite"
    train_start = time.time()
    try:
        history = model.fit_generator(generator = train_batch_gen,
                        steps_per_epoch  = len(train_batch_gen), 
                        epochs           = nb_epoch,
                        validation_data  = valid_batch_gen,
                        validation_steps = len(valid_batch_gen),
                        callbacks        = _create_callbacks(save_best_weights_path, other_callbacks=progress_callbacks),
                        verbose          = 1,
                        workers          = 3,
                        max_queue_size   = 8)
    except KeyboardInterrupt:
        save_model(model, save_final_weights_path, tflite_path)
        raise

    _print_time(time.time() - train_start)
    save_model(model, save_final_weights_path, tflite_path)
    return history

def _print_time(process_time):
    if process_time < 60:
        print("训练用时{:d} 秒 | {:d}-seconds to train".format(int(process_time), int(process_time)))
    else:
        print("训练用时{:d} 分钟 | {:d}-mins to train".format(int(process_time / 60), int(process_time / 60)))


def save_model(model, h5_path, tflite_path=None):
    print("保存 .h5 权重文件到: | save .h5 weights file to: {}".format(h5_path))
    model.save(h5_path, overwrite=True, include_optimizer=False)
    if tflite_path:
        print("保存 tflite 文件到: | save tflite to: {}".format(tflite_path))
        import tensorflow as tf
        # converter = tf.lite.TFLiteConverter.from_keras_model(model)
        # tflite_model = converter.convert()
        # with open (tflite_path, "wb") as f:
        #     f.write(tflite_model)

        ## kpu V3 - nncase = 0.1.0rc5
        # model.save("weights.h5", include_optimizer=False)

        tf.compat.v1.disable_eager_execution()
        converter = tf.compat.v1.lite.TFLiteConverter.from_keras_model_file(h5_path,
                                            output_arrays=['{}/BiasAdd'.format(model.get_layer(None, -2).name)])
        tfmodel = converter.convert()
        with open (tflite_path , "wb") as f:
            f.write(tfmodel)

def _create_callbacks(save_best_weights_path, other_callbacks=[]):
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    import tensorflow as tf
    import warnings

    class CheckpointPB(tf.keras.callbacks.Callback):

        def __init__(self, filepath, monitor='val_loss', verbose=0,
                    save_best_only=False, save_weights_only=True,
                    mode='auto', period=1):
            super(CheckpointPB, self).__init__()
            self.monitor = monitor
            self.verbose = verbose
            self.filepath = filepath
            self.save_best_only = save_best_only
            self.save_weights_only = save_weights_only
            self.period = period
            self.epochs_since_last_save = 0

            if mode not in ['auto', 'min', 'max']:
                warnings.warn('ModelCheckpoint mode %s is unknown, '
                            'fallback to auto mode.' % (mode),
                            RuntimeWarning)
                mode = 'auto'

            if mode == 'min':
                self.monitor_op = np.less
                self.best = np.Inf
            elif mode == 'max':
                self.monitor_op = np.greater
                self.best = -np.Inf
            else:
                if 'acc' in self.monitor or self.monitor.startswith('fmeasure'):
                    self.monitor_op = np.greater
                    self.best = -np.Inf
                else:
                    self.monitor_op = np.less
                    self.best = np.Inf

        def on_epoch_end(self, epoch, logs=None):
            logs = logs or {}
            self.epochs_since_last_save += 1
            if self.epochs_since_last_save >= self.period:
                self.epochs_since_last_save = 0
                filepath = self.filepath.format(epoch=epoch + 1, **logs)
                if self.save_best_only:
                    current = logs.get(self.monitor)
                    if current is None:
                       warnings.warn('只能在 %s 可用时保存最佳模型，跳过此步骤。 | Can save best model only with %s available, skipping.' %   
                                        (self.monitor, self.monitor), RuntimeWarning)
                    else:
                        if self.monitor_op(current, self.best):
                            if self.verbose > 0:
                                if self.monitor == 'loss':
                                    monitor_val = '误差率（loss)'
                                else:
                                    monitor_val = self.monitor
                                print('\n第%d轮(Epoch-%d): %s 从(from) %0.5f 改进到(improve to) %0.5f，保存模型到（save model to) %s' %   
                                        (epoch + 1, epoch + 1, monitor_val, self.best, current, filepath))
                            self.best = current
                            if self.save_weights_only:
                                # self.model.save_weights(filepath, overwrite=True)
                                save_model(self.model, filepath)
                            else:
                                tflite_path = os.path.splitext(filepath)[0]+".tflite"
                                save_model(self.model, filepath, tflite_path)
                        else:
                            if self.verbose > 0:
                                print('\n第%05d轮: %s 没有从 %0.5f 误差率改进 | Epoch %d: %s did not improve from %0.5f' %  
                                        (epoch + 1, self.monitor, self.best, epoch + 1, self.monitor, self.best))
                else:
                    if self.verbose > 0:
                        print('\n第%d轮(Epoch %d): 正在保存模型到(saving model to) %s' %   
                                (epoch + 1, epoch + 1, filepath))
                    if self.save_weights_only:
                        self.model.save_weights(filepath, overwrite=True)
                    else:
                        self.model.save(filepath, overwrite=True)



    # Make a few callbacks
    early_stop = EarlyStopping(monitor='val_loss', 
                       min_delta=0.001, 
                       patience=20, 
                       mode='min', 
                       verbose=1,
                       restore_best_weights=True)
    checkpoint = CheckpointPB(save_best_weights_path, 
                                 monitor='loss', 
                                 verbose=1, 
                                 save_best_only = True,
                                 save_weights_only = True,
                                 mode='min', 
                                 period=1)
    reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.2,
                              patience=20, min_lr=0.00001, verbose=1)
    callbacks = [early_stop, reduce_lr]
    if other_callbacks:
        callbacks.extend(other_callbacks)
    if save_best_weights_path:
        callbacks.append(checkpoint)
    return callbacks
