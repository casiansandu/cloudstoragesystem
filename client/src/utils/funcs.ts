
import { v5 as uuidv5 } from 'uuid';
import { public_namespace_uuid } from '../constants';

export function concatUint8(a: Uint8Array | ArrayBuffer, b: Uint8Array | ArrayBuffer): Uint8Array {
    
    const viewA = a instanceof Uint8Array ? a : new Uint8Array(a);
    const viewB = b instanceof Uint8Array ? b : new Uint8Array(b);

    const result = new Uint8Array(viewA.length + viewB.length);
    
    result.set(viewA, 0);
    result.set(viewB, viewA.length);
    
    return result;
}


export function gen_uuidv5(s: string): string {
    return uuidv5(s, public_namespace_uuid);
}
