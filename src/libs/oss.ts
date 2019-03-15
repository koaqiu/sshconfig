import FS from 'fs';
import oss from 'ali-oss';

const client = new oss({
    accessKeyId: '0',
    accessKeySecret: '0',
    bucket: '0',
    region: 'oss-cn-shanghai'
});

const downloadFile = async (objKey: string, localFile?: string | FS.WriteStream): Promise<Buffer | boolean | null> => {
    const r = await client.get(objKey, localFile).catch(err => err);
    if (r.code == 'NoSuchKey') {
        return null;
    }
    return r.content ? r.content : true;
}

const uploadFile = async (fileToUpload: string | Buffer | FS.ReadStream, objKey: string) => {
    return await client.put(objKey, fileToUpload).catch(err => err);
}
const uploadData = async (data: string | Buffer | FS.ReadStream | any, objKey: string) => {
    if (data instanceof Buffer || data instanceof FS.ReadStream) {
        return await uploadFile(data, objKey);
    }
    if (typeof data == 'object') {
        data = JSON.stringify(data);
    }
    return await uploadFile(Buffer.from(data), objKey);
}
const search = async (prefix: string, nextMarker?: string, count = 100) => {
    //marker: result.nextMarker
    const query = {
        prefix, nextMarker, 'max-keys': count
    }
    let result = await client.list(query, {});
    // console.log(result);
    return result;
}

const exists = async (objKey: string) => {
    let result = await search(objKey);
    do {
        if (Array.isArray(result.objects)) {
            if (result.objects.some(obj => obj.name == objKey)) {
                return true;
            } else if (result.isTruncated) {
                result = await search(objKey, result.nextMarker);
            } else {
                return false;
            }
        } else {
            return false;
        }
    } while (result);
    return false;
}
export default {
    downloadFile,
    exists,
    uploadFile,
    uploadData,
    search
}
