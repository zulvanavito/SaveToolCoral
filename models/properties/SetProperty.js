import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class SetProperty extends Property {
  constructor() {
    super();
    this.Type = "SetProperty";
    this.InnerType = "";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.NumKeysToRemove = 0;
    this.Entries = [];
    this.RawData = "";
  }

  get ValueSize() {
    if (this.RawData) {
      return Buffer.from(this.RawData, "base64").length;
    }
    let size = 4 + 4; // NumKeysToRemove + Count
    let cleanInner = this.InnerType.replace(/\0$/, "");
    if (cleanInner === "NameProperty" || cleanInner === "StrProperty") {
      for (let item of this.Entries) {
        let str = typeof item === "string" ? item : "";
        if (!str.endsWith("\0")) str += "\0";
        size += Buffer.byteLength(str, "utf8") + 4;
      }
    }
    return size;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4;
    let innerStr = this.InnerType.endsWith("\0")
      ? this.InnerType
      : this.InnerType + "\0";
    size += Buffer.byteLength(innerStr, "utf8") + 4;
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
    this.InnerType = serial.readString();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }

    let startOffset = serial.tell;
    try {
      let cleanInner = this.InnerType.replace(/\0$/, "");
      if (cleanInner === "NameProperty" || cleanInner === "StrProperty") {
        this.NumKeysToRemove = serial.readInt32();
        let count = serial.readInt32();
        this.Entries = [];
        for (let i = 0; i < count; i++) {
          this.Entries.push(serial.readString());
        }
        if (serial.tell - startOffset !== size) {
          serial.tell = startOffset;
          this.RawData = serial.read(size).toString("base64");
          this.Entries = [];
        }
      } else {
        this.RawData = serial.read(size).toString("base64");
      }
    } catch (e) {
      serial.tell = startOffset;
      this.RawData = serial.read(size).toString("base64");
    }
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeString(this.InnerType);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }

    if (this.RawData) {
      serial.writeBytes(Buffer.from(this.RawData, "base64"));
    } else {
      serial.writeInt32(this.NumKeysToRemove);
      serial.writeInt32(this.Entries.length);
      for (let item of this.Entries) {
        serial.writeString(item);
      }
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new SetProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.InnerType = obj.InnerType || "";
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.NumKeysToRemove = obj.NumKeysToRemove || 0;
    prop.Entries = obj.Entries || [];
    prop.RawData = obj.RawData || "";
    return prop;
  }
}
