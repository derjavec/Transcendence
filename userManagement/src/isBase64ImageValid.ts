import * as fileType from 'file-type';
import sharp from 'sharp';

export async function isBase64ImageValid(base64String: string): Promise<boolean>{
    
    const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
    if(!matches)
        return false;

    const mimeFromData= matches[1];
    const base64Data = matches[2];
    let buffer: Buffer;

    try{
        buffer = Buffer.from(base64Data, 'base64');
    }catch(e){
        return false;
    }

    const fileTypeResult = await fileType.fromBuffer(buffer);
    if(!fileTypeResult || !fileTypeResult.mime.startsWith('image')) {
        return false;
    }

    if(fileTypeResult.mime !== mimeFromData) {
        return false;
    }

     // ✅ test réel : tenter d'ouvrir l'image
    try {
    await sharp(buffer).metadata(); // si ça plante ici, ce n’est PAS une vraie image
    } catch {
    return false;
    } 

    return true;
}