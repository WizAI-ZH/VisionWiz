'''
    gpu utils

    @author neucrack
    @license MIT © 2020 neucrack
'''



import pynvml
import os
import multiprocessing
import tensorflow as tf

class GPU_info:
    def __init__(self, id=-1, name="", mem_free=0, mem_total=0):
        self.id = id
        self.name = name
        self.mem_free = mem_free
        self.mem_total = mem_total
    
    def __str__(self):
        msg = "GPU:{}:{}, used:{}/{}MB, free:{}MB".format(self.id, self.name, (self.mem_total - self.mem_free)/1024/1024, self.mem_total/1024/1024, self.mem_free/1024/1024)
        return msg

def is_gpu_exist(create_sub_process=True):
    def func0():
        try:
            pynvml.nvmlInit()
            gpu_num = pynvml.nvmlDeviceGetCount()
            pynvml.nvmlShutdown()
            
            gpus = tf.config.experimental.list_physical_devices('GPU')
            
            if gpu_num > 0 and len(gpus) > 0:
                return True
        except Exception:
            pass
        finally:
            pynvml.nvmlShutdown()
        return False
    def func(is_exits):
        is_exits.value = func0()
    if create_sub_process:
        is_exits = multiprocessing.Value("b", False)
        p = multiprocessing.Process(target=func, args=(is_exits,))
        p.start()
        p.join()
        return True if (is_exits.value != 0) else False
    else:
        return func0()

def func0(memory_require=128*1024*1024, tf_gpu_mem_growth=False, logger=None, console=True):
    try:
        gpu = None
        pynvml.nvmlInit()
        gpu_num = pynvml.nvmlDeviceGetCount()
        # check nvidia driver
        
        gpus = tf.config.experimental.list_physical_devices('GPU')
        
        if gpu_num <= 0 or len(gpus) <= 0:
            pynvml.nvmlShutdown()
            if len(gpus) <= 0 and gpu_num > 0:
                msg = "have {} GPU, but tensorflow can not detect, check driver or tensorflow if GPU version".format(gpu_num)
            else:
                msg = "NO GPU"

            if logger:
                logger.i(msg)
            if console:
                print(msg)
            return gpu

        for i in range(gpu_num):
            h = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(h)
            try:
                gpu_name = name.decode()
            except:
                gpu_name = name
            info = pynvml.nvmlDeviceGetMemoryInfo(h)
            msg = "GPU:{}, used:{}/{}MB, free:{}MB".format(gpu_name, info.used/1024/1024, info.total/1024/1024, info.free/1024/1024)
            if logger:
                logger.i(msg)
            if console:
                print(msg)
            if info.free >= memory_require:
                gpu = GPU_info(id = i, name = gpu_name, mem_free = info.free, mem_total = info.total)
                os.environ["CUDA_VISIBLE_DEVICES"] = str(i)
                
                tf.config.experimental.set_memory_growth(gpus[i], True)
                
                break
        pynvml.nvmlShutdown()
    except Exception as e:
        msg = "select gpu fail:{}".format(e)
        if logger:
            logger.i(msg)
        if console:
            print(msg)
    finally:
        pynvml.nvmlShutdown()
    return gpu

def func(memory_require=128*1024*1024, tf_gpu_mem_growth=False, logger=None, console=True, pipe=None):
    gpu = func0(memory_require, tf_gpu_mem_growth, logger, console)
    pipe.send(gpu)


def select_gpu(memory_require=128*1024*1024, tf_gpu_mem_growth=False, logger=None, console=True, create_sub_process=False):
    if not create_sub_process:
        return func0(memory_require, tf_gpu_mem_growth, logger, console)
    else:
        pipe_rx, pipe_tx = multiprocessing.Pipe(duplex=False)
        p = multiprocessing.Process(target=func, args=(memory_require, tf_gpu_mem_growth, logger, console, pipe_tx))
        p.start()
        gpu = pipe_rx.recv()
        p.join()
        return gpu


if __name__ == "__main__":
    gpu = select_gpu(console=True)
    print("select ", gpu)

