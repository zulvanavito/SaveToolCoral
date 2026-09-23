import { TypeNotImplementedError } from "../PropertyErrors.js";

class Factory {
  constructor() {
    this.Properties = {};
    this.Arrays = {};
  }
  create(obj) {
    let type = obj.Type ? obj.Type.split("\0")[0] : "UnknownProperty";

    if (this.Properties[type] !== undefined) {
      return this.Properties[type].from(obj);
    }

    if (this.Properties["UnknownProperty"] !== undefined) {
      return this.Properties["UnknownProperty"].from(obj);
    }

    throw new TypeNotImplementedError(type);
  }
  createArray(obj) {
    let type = obj.Type ? obj.Type.split("\0")[0] : "UnknownProperty";

    if (this.Arrays[type] !== undefined) {
      return this.Arrays[type].from(obj);
    }

    if (this.Properties[type] !== undefined) {
      return this.Properties[type].from(obj);
    }

    if (this.Properties["UnknownProperty"] !== undefined) {
      return this.Properties["UnknownProperty"].from(obj);
    }

    throw new TypeNotImplementedError(type);
  }
}

export const PropertyFactory = new Factory();
