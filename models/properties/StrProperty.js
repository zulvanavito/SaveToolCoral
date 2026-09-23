import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class StrProperty extends Property {
  constructor() {
    super();
    this.Type = "StrProperty";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Property = "";
  }

  get ValueSize() {
    let str = typeof this.Property === "string" ? this.Property : "";
    if (!str || str.length === 0) {
      return 4; // 4-byte zero length
    }
    if (!str.endsWith("\0")) str += "\0";
    return Buffer.byteLength(str, "utf8") + 4;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1;
    if (this.HasPropertyGuid === 1) size += 16;
    size += this.ValueSize;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }
    this.Property = serial.readString();
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    serial.writeString(this.Property);
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new StrProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Property = obj.Property !== undefined ? obj.Property : "";
    return prop;
  }
}
