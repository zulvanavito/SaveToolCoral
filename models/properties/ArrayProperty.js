import { Property } from "./Property.js";
import { PropertyFactory } from "../factories/PropertyFactory.js";
import { Serializer } from "../../utils/Serializer.js";

export class ArrayProperty extends Property {
  constructor() {
    super();
    this.Type = "ArrayProperty";
    this.StoredPropertyType = "";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Count = 0;
    // If struct array
    this.StructTag = null;
    this.Elements = [];
    this.RawData = "";
  }

  get HeaderSize() {
    let nameStr = this.Name.endsWith("\0") ? this.Name : this.Name + "\0";
    let typeStr = this.Type.endsWith("\0") ? this.Type : this.Type + "\0";
    let storedStr = this.StoredPropertyType.endsWith("\0")
      ? this.StoredPropertyType
      : this.StoredPropertyType + "\0";

    let size = Buffer.byteLength(nameStr, "utf8") + 4;
    size += Buffer.byteLength(typeStr, "utf8") + 4;
    size += 8; // 4 byte size + 4 byte array index
    size += Buffer.byteLength(storedStr, "utf8") + 4;
    size += 1; // 1 byte hasPropertyGuid
    if (this.HasPropertyGuid === 1) size += 16;
    return size;
  }

  get ValueSize() {
    if (this.RawData) {
      return 4 + Buffer.from(this.RawData, "base64").length;
    }

    let cleanStored = this.StoredPropertyType.replace(/\0$/, "");
    if (cleanStored === "StructProperty" && this.StructTag) {
      let innerTagSize =
        this.StructTag.Name.length +
        4 +
        (this.StructTag.Type.length + 4) +
        8 +
        (this.StructTag.StructType.length + 4) +
        16 +
        1;
      let elemSize = 0;
      for (let elem of this.Elements) {
        if (elem.ValueSize !== undefined) {
          elemSize += elem.ValueSize;
        } else if (elem.Size !== undefined) {
          elemSize += elem.Size;
        }
      }
      return 4 + innerTagSize + elemSize;
    } else if (
      cleanStored === "NameProperty" ||
      cleanStored === "StrProperty"
    ) {
      let strBytes = 0;
      for (let str of this.Elements) {
        let s = typeof str === "string" ? str : "";
        if (s.length === 0) {
          strBytes += 4;
        } else {
          if (!s.endsWith("\0")) s += "\0";
          strBytes += Buffer.byteLength(s, "utf8") + 4;
        }
      }
      return 4 + strBytes;
    } else if (cleanStored === "IntProperty") {
      return 4 + this.Elements.length * 4;
    }
    return 4;
  }

  get Size() {
    return this.HeaderSize + this.ValueSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.StoredPropertyType = serial.readString();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }

    let payloadStart = serial.tell;
    let payloadEnd = payloadStart + size;

    this.Count = serial.readInt32();
    let cleanStored = this.StoredPropertyType.replace(/\0$/, "");

    try {
      if (cleanStored === "StructProperty" && this.Count > 0) {
        let arrayName = serial.readString();
        let arrayType = serial.readString();
        let structArrSize = serial.readInt32();
        let structArrIdx = serial.readInt32();
        let structType = serial.readString();
        let structGuid = serial.readBytes(16).toString("hex");
        let structHasGuid = serial.readUInt8();

        this.StructTag = {
          Name: arrayName,
          Type: arrayType,
          Size: structArrSize,
          ArrayIndex: structArrIdx,
          StructType: structType,
          StructGuid: structGuid,
          HasPropertyGuid: structHasGuid,
        };

        this.Elements = [];
        let rawStructs = new Set([
          "Vector",
          "Rotator",
          "Quat",
          "LinearColor",
          "DateTime",
          "Guid",
          "IntPoint",
          "IntVector",
          "Transform",
          "SoftObjectPath",
        ]);
        let cleanStructType = structType.replace(/\0$/, "");
        let isRawStruct = rawStructs.has(cleanStructType);
        let rawElemSize = isRawStruct
          ? Math.floor(structArrSize / this.Count)
          : 0;

        for (let i = 0; i < this.Count; i++) {
          let structProp = PropertyFactory.create({
            Name: arrayName,
            Type: "StructProperty",
          });
          structProp.StoredPropertyType = structType;
          structProp.StructGuid = structGuid;
          structProp.Properties = [];

          if (isRawStruct) {
            structProp.RawData = serial.read(rawElemSize).toString("base64");
          } else {
            while (serial.tell < payloadEnd) {
              let pName = serial.readString();
              if (pName === "None\0" || pName === "None") break;
              let pType = serial.readString();
              let pSize = serial.readInt32();
              let prop = PropertyFactory.create({ Name: pName, Type: pType });
              prop.deserialize(serial, pSize);
              structProp.Properties.push(prop);
            }
          }
          this.Elements.push(structProp);
        }
        serial.tell = payloadEnd;
      } else if (
        cleanStored === "NameProperty" ||
        cleanStored === "StrProperty"
      ) {
        this.Elements = [];
        for (let i = 0; i < this.Count; i++) {
          this.Elements.push(serial.readString());
        }
        if (serial.tell !== payloadEnd) {
          serial.tell = payloadStart + 4;
          this.RawData = serial.read(size - 4).toString("base64");
          this.Elements = [];
        }
      } else if (cleanStored === "IntProperty") {
        this.Elements = [];
        for (let i = 0; i < this.Count; i++) {
          this.Elements.push(serial.readInt32());
        }
      } else {
        this.RawData = serial.read(size - 4).toString("base64");
      }
    } catch (err) {
      serial.tell = payloadStart + 4;
      this.RawData = serial.read(size - 4).toString("base64");
      this.Elements = [];
    }

    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.Size);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeString(this.StoredPropertyType);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }

    let countToWrite = this.RawData
      ? this.Count
      : this.Elements
        ? this.Elements.length
        : this.Count;
    serial.writeInt32(countToWrite);

    if (this.RawData) {
      serial.writeBytes(Buffer.from(this.RawData, "base64"));
    } else {
      let cleanStored = this.StoredPropertyType.replace(/\0$/, "");
      if (cleanStored === "StructProperty" && this.StructTag) {
        serial.writeString(this.StructTag.Name);
        serial.writeString(this.StructTag.Type);
        // Calculate inner struct payload size
        let elemBytes = 0;
        for (let elem of this.Elements) {
          elemBytes += elem.ValueSize;
        }
        serial.writeInt32(elemBytes);
        serial.writeInt32(this.StructTag.ArrayIndex || 0);
        serial.writeString(this.StructTag.StructType);
        serial.writeBytes(
          Buffer.from(
            this.StructTag.StructGuid || "00000000000000000000000000000000",
            "hex",
          ),
        );
        serial.writeUInt8(this.StructTag.HasPropertyGuid || 0);

        for (let elem of this.Elements) {
          for (let p of elem.Properties) {
            serial.write(p.serialize());
          }
          serial.writeString("None\0");
        }
      } else if (
        cleanStored === "NameProperty" ||
        cleanStored === "StrProperty"
      ) {
        for (let str of this.Elements) {
          serial.writeString(str);
        }
      } else if (cleanStored === "IntProperty") {
        for (let num of this.Elements) {
          serial.writeInt32(num);
        }
      }
    }

    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let arr = new ArrayProperty();
    arr.Name = obj.Name;
    arr.Type = obj.Type;
    arr.StoredPropertyType = obj.StoredPropertyType;
    arr.ArrayIndex = obj.ArrayIndex || 0;
    arr.HasPropertyGuid = obj.HasPropertyGuid || 0;
    arr.PropertyGuid = obj.PropertyGuid || null;
    arr.Count =
      obj.Elements && Array.isArray(obj.Elements)
        ? obj.Elements.length
        : obj.Count || 0;
    arr.StructTag = obj.StructTag || null;
    arr.RawData = obj.RawData || "";
    arr.Elements = [];
    if (obj.Elements && Array.isArray(obj.Elements)) {
      let cleanStored = (obj.StoredPropertyType || "").replace(/\0$/, "");
      if (cleanStored === "StructProperty") {
        obj.Elements.forEach((elem) =>
          arr.Elements.push(PropertyFactory.create(elem)),
        );
      } else {
        arr.Elements = [...obj.Elements];
      }
    }
    return arr;
  }
}
