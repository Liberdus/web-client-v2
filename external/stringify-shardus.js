    const objToString = Object.prototype.toString

    const objKeys = Object.keys || function(obj) {
        const keys = []
        for (const name in obj) {
            keys.push(name)
        }
        return keys
    }

    const isObject = (val) => {
        if (val === null) {
            return false
        }
        if (Array.isArray(val)) {
            return false
        }
        return typeof val === 'function' || typeof val === 'object'
    }

    const isUint8Array = (val) => {
        return val instanceof Uint8Array
    }

    const uint8ArrayToBase64 = (uint8Array) => {
        let binary = ''
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i])
        }
        return btoa(binary)
    }

    const base64ToUint8Array = (base64) => {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes
    }

    function safeStringify(val, options = { bufferEncoding: 'base64' }) {
        const returnVal = stringifyHelper(val, false, options)
        if (returnVal !== undefined) {
            return '' + returnVal
        }
    }

    function safeJsonParse(value) {
        return JSON.parse(value, typeReviver)
    }

    function isBufferValue(toStr, val) {
        return (
            toStr === '[object Object]' &&
            objKeys(val).length === 2 &&
            objKeys(val).includes('type') &&
            val['type'] === 'Buffer'
        )
    }

    function stringifyHelper(val, isArrayProp, options = { bufferEncoding: 'base64' }) {
        if (options === null) options = { bufferEncoding: 'base64' }
        let i, max, str, keys, key, propVal, toStr

        if (val === true) {
            return 'true'
        }
        if (val === false) {
            return 'false'
        }

        switch (typeof val) {
            case 'object':
                if (val === null) {
                    return null
                } else if ('toJSON' in val && typeof val.toJSON === 'function') {
                    return stringifyHelper(val.toJSON(), isArrayProp, options)
                } else {
                    toStr = objToString.call(val)
                    if (toStr === '[object Array]') {
                        str = '['
                        max = val.length - 1
                        for (i = 0; i < max; i++) {
                            str += stringifyHelper(val[i], true) + ','
                        }
                        if (max > -1) {
                            str += stringifyHelper(val[i], true)
                        }
                        return str + ']'
                    } else if (isUint8Array(val)) {
                        return JSON.stringify({
                            value: uint8ArrayToBase64(val),
                            dataType: 'u8ab'
                        })
                    } else if (
                        options.bufferEncoding !== 'none' &&
                        isBufferValue(toStr, val)
                    ) {
                        switch (options.bufferEncoding) {
                            case 'base64':
                                return JSON.stringify({
                                    value: uint8ArrayToBase64(new Uint8Array(val['data'])),
                                    dataType: 'bb'
                                })
                        }
                    } else if (toStr === '[object Object]') {
                        keys = objKeys(val).sort()
                        max = keys.length
                        str = ''
                        i = 0
                        while (i < max) {
                            key = keys[i]
                            propVal = stringifyHelper(val[key], false, options)
                            if (propVal !== undefined) {
                                if (str) {
                                    str += ','
                                }
                                str += JSON.stringify(key) + ':' + propVal
                            }
                            i++
                        }
                        return '{' + str + '}'
                    } else {
                        return JSON.stringify(val)
                    }
                }
            case 'function':
            case 'undefined':
                return isArrayProp ? null : undefined
            case 'string':
                return JSON.stringify(val)
            case 'bigint':
                return JSON.stringify({ dataType: 'bi', value: val.toString(16) })
            default:
                return isFinite(val) ? val : null
        }
    }

    function getUint8ArrayFromField(input, encoding) {
        switch (encoding) {
            case 'base64':
                return base64ToUint8Array(input.value)
            default:
                return new Uint8Array(input)
        }
    }

    function typeReviver(key, value) {
        if (key === 'sig') return value
        const originalObject = value
        if (
            isObject(originalObject) &&
            Object.prototype.hasOwnProperty.call(originalObject, 'dataType') &&
            originalObject.dataType
        ) {
            if (originalObject.dataType === 'bb' || originalObject.dataType === 'u8ab') {
                if (typeof originalObject.value !== 'string') {
                    return value
                }
                return originalObject.dataType === 'bb'
                    ? getUint8ArrayFromField(originalObject, 'base64')
                    : base64ToUint8Array(originalObject.value)
            } else if (originalObject.dataType === 'bi') {
                return BigInt('0x' + originalObject.value)
            } else {
                return value
            }
        } else {
            return value
        }
    }

    function stringify(val, opt){
        return safeStringify(val, opt)
    }
    function parse(val){
        return safeJsonParse(val)
    }

/*
    // Return public API
    export {
        safeStringify,
        safeJsonParse
    }
*/

    export {
       stringify,
       parse
    }
