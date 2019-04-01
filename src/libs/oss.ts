import FS from 'fs';
import oss from 'ali-oss';

export interface IOssResponse<T> {
    success: boolean;
    code: string;
    status: number;
    data?: T,
    extData?: any
}
export interface IOssResult {
    res: oss.NormalSuccessResponse;
}
const fixError = <T>(err: any): IOssResponse<T> => {
    // console.log(err)
    return {
        success: false,
        code: err.code,
        status: err.status,
        extData: err
    }
}
const fixSuccess = <T>(data: T & IOssResult): IOssResponse<T> => {
    return {
        success: true,
        code: '',
        status: data.res.status,
        data
    }
};
export default class OSS {
    private client: oss;
    constructor(options: oss.Options) {
        this.client = new oss(options);
    };
    public async test(){
        const result = await this.search(undefined, undefined, 1)
        // if (result.success === false) {
        //     throw new Error('OSS配置错误');
        // }
        return result;
    }
    public async downloadFile(objKey: string, localFile?: string | FS.WriteStream): Promise<Buffer | boolean | null> {
        const r = await this.client.get(objKey, localFile).catch(err => err);
        if (r.code == 'NoSuchKey') {
            return null;
        }
        return r.content ? r.content : true;
    }

    public async uploadFile(fileToUpload: string | Buffer | FS.ReadStream, objKey: string) {
        return await this.client.put(objKey, fileToUpload)
            .then(res => fixSuccess<oss.PutObjectResult>(res))
            .catch(err => fixError<oss.PutObjectResult>(err));
    }
    public async uploadData(data: string | Buffer | FS.ReadStream | any, objKey: string) {
        if (data instanceof Buffer || data instanceof FS.ReadStream) {
            return await this.uploadFile(data, objKey);
        }
        if (typeof data == 'object') {
            data = JSON.stringify(data);
        }
        return await this.uploadFile(Buffer.from(data), objKey);
    }
    public async search(prefix?: string, nextMarker?: string, count = 100) {
        //marker: result.nextMarker
        const query = {
            prefix, nextMarker, 'max-keys': count
        }
       
        let result = await this.client.list(query, {})
        .then(res => fixSuccess<oss.ListObjectResult>(res))
        .catch(err => fixError<oss.ListObjectResult>(err));
        return result;
    }

    public async exists(objKey: string) {
        let result = await this.search(objKey);
        if(result.success === false) return false;
        do {
            const data = result.data;
            if(!data) return false;
            if (Array.isArray(data.objects)) {
                if (data.objects.some(obj => obj.name == objKey)) {
                    return true;
                } else if (data.isTruncated) {
                    result = await this.search(objKey, data.nextMarker);
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } while (result);
        return false;
    }
}
