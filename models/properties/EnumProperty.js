import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class EnumProperty extends Property {
  constructor() {
    super();
    this.Type = "EnumProperty";
    this.EnumType = "";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Property = "None\0";
  }

  get ValueSize() {
    let str = typeof this.Property === "string" ? this.Property : "";
    if (!str.endsWith("\0")) str += "\0";
    return Buffer.byteLength(str, "utf8") + 4;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4;
    let enumTypeStr = this.EnumType.endsWith("\0")
      ? this.EnumType
      : this.EnumType + "\0";
    size += Buffer.byteLength(enumTypeStr, "utf8") + 4;
    size += 1;
    if (this.HasPropertyGuid === 1) size += 16;
    size += this.ValueSize;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.EnumType = serial.readString();
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
    serial.writeString(this.EnumType);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    serial.writeString(this.Property);
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new EnumProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.EnumType = obj.EnumType || "";
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Property = obj.Property !== undefined ? obj.Property : "None\0";
    return prop;
  }
}
