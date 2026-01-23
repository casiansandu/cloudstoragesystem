
import { v5 as uuidv5 } from 'uuid';
import { public_namespace_uuid } from '../constants';

export function concatUint8(...args: (Uint8Array | ArrayBuffer)[]): Uint8Array {
    // 1. Convert all inputs to Uint8Array views and calculate total length
    const views = args.map(arg => arg instanceof Uint8Array ? arg : new Uint8Array(arg));
    const totalLength = views.reduce((sum, view) => sum + view.length, 0);

    // 2. Create the result buffer
    const result = new Uint8Array(totalLength);
    
    // 3. Set each buffer at the correct offset
    let offset = 0;
    for (const view of views) {
        result.set(view, offset);
        offset += view.length;
    }
    
    return result;
}


export function gen_uuidv5(s: string): string {
    return uuidv5(s, public_namespace_uuid);
}
