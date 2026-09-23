import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class BoolProperty extends Property {
  constructor() {
    super();
    this.Type = "BoolProperty";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Property = false;
  }

  get ValueSize() {
    return 0; // In UE4, BoolProperty size in tag is 0
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1 + 1;
    if (this.HasPropertyGuid === 1) size += 16;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.Property = serial.readUInt8() === 1;
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(0);
    serial.writeInt32(this.ArrayIndex);
    serial.writeUInt8(this.Property === true ? 1 : 0);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new BoolProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Property = obj.Property === true;
    return prop;
  }
}
