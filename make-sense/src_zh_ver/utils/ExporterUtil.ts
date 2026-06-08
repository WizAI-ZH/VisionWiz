import moment from 'moment';
import {GeneralSelector} from '../store/selectors/GeneralSelector';
import {saveAs} from 'file-saver';

export class ExporterUtil {
    public static getExportFileName(): string {
        const projectName: string = GeneralSelector.getProjectName();
        const date: string = moment().format('YYYY-MM-DD-hh-mm-ss');
        return `labels_${projectName}_${date}`
    }

    public static saveAs(content: string | Blob, fileName: string): void {
        const blob = content instanceof Blob ? content : new Blob([content], {type: 'text/plain;charset=utf-8'});
        try {
            saveAs(blob, fileName);
        } catch (error) {
            // TODO: Implement file save error handling
            throw new Error(error as string);
        }
    }
}
