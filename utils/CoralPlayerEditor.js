import { PropertyFactory } from "../models/factories/index.js";

export class CoralPlayerEditor {
  /**
   * Find player structs (pendingChangedPlayerInfo and playerInfo) inside Gvas or JSON object
   */
  static findTargetStructs(root) {
    let pendingChangedPlayerInfo = null;
    let playerInfo = null;

    function traverse(node) {
      if (!node || typeof node !== "object") return;

      let structType = (node.StoredPropertyType || "")
        .replace(/\0/g, "")
        .trim();
      let name = (node.Name || "").replace(/\0/g, "").trim();

      if (
        structType === "C_ChangedPlayerInfo" ||
        name === "pendingChangedPlayerInfo"
      ) {
        pendingChangedPlayerInfo = node;
      }
      if (structType === "C_PlayerInformation" || name === "playerInfo") {
        playerInfo = node;
      }

      if (Array.isArray(node)) {
        for (let item of node) {
          traverse(item);
        }
      } else {
        for (let key of Object.keys(node)) {
          traverse(node[key]);
        }
      }
    }

    traverse(root);
    return { pendingChangedPlayerInfo, playerInfo };
  }

  /**
   * Get a string property from a struct
   */
  static getPropValue(structNode, propName) {
    if (!structNode || !structNode.Properties) return "";
    let prop = structNode.Properties.find(
      (p) =>
        p.Name &&
        p.Name.replace(/\0/g, "").trim().toLowerCase() ===
          propName.toLowerCase(),
    );
    if (!prop) return "";
    let val =
      prop.Property !== undefined
        ? prop.Property
        : prop.Value !== undefined
          ? prop.Value
          : "";
    if (typeof val === "string") {
      return val.replace(/\0/g, "").trim();
    }
    return String(val);
  }

  /**
   * Set a string property value on a struct
   */
  static setPropValue(structNode, propName, newValue) {
    if (!structNode || !structNode.Properties) return false;
    let prop = structNode.Properties.find(
      (p) =>
        p.Name &&
        p.Name.replace(/\0/g, "").trim().toLowerCase() ===
          propName.toLowerCase(),
    );
    if (!prop) return false;

    let toSet = newValue;
    if (
      typeof toSet === "string" &&
      toSet.length > 0 &&
      !toSet.endsWith("\0")
    ) {
      toSet = toSet + "\0";
    }
    prop.Property = toSet;
    if (prop.Value !== undefined) {
      prop.Value = toSet;
    }
    return true;
  }

  /**
   * Normalize gender enum string
   */
  static normalizeGender(gender) {
    if (!gender) return "";
    let clean = gender.replace(/\0/g, "").trim();
    let lower = clean.toLowerCase();
    if (lower === "male" || lower === "m") return "EC_Gender::Male\0";
    if (lower === "female" || lower === "f") return "EC_Gender::Female\0";
    if (lower === "other" || lower === "mx") return "EC_Gender::Other\0";
    if (lower === "custom") return "EC_Gender::Custom\0";
    if (lower === "none") return "EC_Gender::None\0";
    if (!clean.endsWith("\0")) return clean + "\0";
    return clean;
  }

  /**
   * Get current player information
   */
  static getPlayerInfo(root) {
    let { pendingChangedPlayerInfo, playerInfo } = this.findTargetStructs(root);

    let name =
      this.getPropValue(playerInfo, "Name") ||
      this.getPropValue(pendingChangedPlayerInfo, "playerName") ||
      "";
    let gender =
      this.getPropValue(playerInfo, "gender") ||
      this.getPropValue(pendingChangedPlayerInfo, "gender") ||
      "";
    let title =
      this.getPropValue(playerInfo, "CustomGenderText") ||
      this.getPropValue(pendingChangedPlayerInfo, "CustomGenderText") ||
      "";
    let parentLabel =
      this.getPropValue(playerInfo, "parentLabel") ||
      this.getPropValue(pendingChangedPlayerInfo, "parentLabel") ||
      "";
    let farmName =
      this.getPropValue(playerInfo, "farmName") ||
      this.getPropValue(pendingChangedPlayerInfo, "farmName") ||
      "";

    return {
      name,
      gender,
      title,
      parentLabel,
      farmName,
    };
  }

  /**
   * Modify player info
   */
  static editPlayer(root, options = {}) {
    let { pendingChangedPlayerInfo, playerInfo } = this.findTargetStructs(root);

    if (!playerInfo && !pendingChangedPlayerInfo) {
      throw new Error(
        "Could not find player information structs (C_PlayerInformation or C_ChangedPlayerInfo) in save data.",
      );
    }

    let before = this.getPlayerInfo(root);

    let newName = options.name !== undefined ? options.name : before.name;
    let newTitle = options.title !== undefined ? options.title : before.title;
    let newFarm =
      options.farmName !== undefined ? options.farmName : before.farmName;

    // Handle gender logic:
    // In Coral Island (UE 4.27 UC_TextUtilConfig::GetGenderTitle):
    // - EC_Gender::Female hardcodes 'Ms.' -> localized in Indonesian as 'Nona'
    // - EC_Gender::Male hardcodes 'Mr.' -> localized in Indonesian as 'Tuan'
    // - EC_Gender::Other hardcodes 'Mx.'
    // - EC_Gender::Custom uses CustomGenderText
    // If setting a custom title (like 'Kak'), gender MUST be EC_Gender::Custom
    // so that dialogue system reads CustomGenderText instead of hardcoding 'Nona'/'Tuan'.
    let newGender = before.gender;
    if (options.gender !== undefined) {
      newGender = this.normalizeGender(options.gender);
    } else if (options.title !== undefined && options.title !== "") {
      newGender = "EC_Gender::Custom\0";
    }

    // Update playerInfo (C_PlayerInformation)
    if (playerInfo) {
      if (options.name !== undefined) {
        this.setPropValue(playerInfo, "Name", newName);
        this.setPropValue(playerInfo, "SanitizedName", newName);
      }
      if (options.title !== undefined) {
        this.setPropValue(playerInfo, "CustomGenderText", newTitle);
        this.setPropValue(playerInfo, "sanitizedCustomGender", newTitle);
        this.setPropValue(playerInfo, "parentLabel", newTitle);
        this.setPropValue(playerInfo, "sanitizedParentLabel", newTitle);
      }
      if (newGender) {
        this.setPropValue(playerInfo, "gender", newGender);
      }
      if (options.farmName !== undefined) {
        this.setPropValue(playerInfo, "farmName", newFarm);
        this.setPropValue(playerInfo, "sanitizedFarmName", newFarm);
      }
    }

    // Update pendingChangedPlayerInfo (C_ChangedPlayerInfo)
    if (pendingChangedPlayerInfo) {
      if (options.name !== undefined) {
        this.setPropValue(pendingChangedPlayerInfo, "playerName", newName);
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedPlayerName",
          newName,
        );
      }
      if (options.title !== undefined) {
        this.setPropValue(
          pendingChangedPlayerInfo,
          "CustomGenderText",
          newTitle,
        );
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedCustomGenderText",
          newTitle,
        );
        this.setPropValue(pendingChangedPlayerInfo, "parentLabel", newTitle);
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedParentLabel",
          newTitle,
        );
      }
      if (newGender) {
        this.setPropValue(pendingChangedPlayerInfo, "gender", newGender);
      }
      if (options.farmName !== undefined) {
        this.setPropValue(pendingChangedPlayerInfo, "farmName", newFarm);
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedFarmName",
          newFarm,
        );
      }
    }

    let after = this.getPlayerInfo(root);

    return {
      before,
      after,
    };
  }

  /**
   * Find player save data (C_PlayerSaveData) containing inventory and storage
   */
  static findPlayerSaveData(root) {
    let target = null;
    function traverse(node) {
      if (!node || typeof node !== "object" || target) return;
      let structType = (node.StoredPropertyType || "")
        .replace(/\0/g, "")
        .trim();
      let name = (node.Name || "").replace(/\0/g, "").trim();

      if (structType === "C_PlayerSaveData") {
        target = node;
        return;
      }
      if (name === "players" && node.Elements && node.Elements.length > 0) {
        target = node.Elements[0];
        return;
      }

      if (Array.isArray(node)) {
        for (let item of node) traverse(item);
      } else {
        for (let key of Object.keys(node)) traverse(node[key]);
      }
    }
    traverse(root);
    return target;
  }

  /**
   * Get all inventory items from save data
   */
  static getInventory(root) {
    let playerData = this.findPlayerSaveData(root);
    if (!playerData || !playerData.Properties) return [];
    let invProp = playerData.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim().toLowerCase() === "inventory",
    );
    if (!invProp || !invProp.Elements) return [];

    return invProp.Elements.map((el, index) => {
      let slotIndex = -1;
      let id = "";
      let quantity = 1;
      let charges = -1;
      let maxCharges = -1;

      if (el.Properties) {
        for (let p of el.Properties) {
          let pName = (p.Name || "").replace(/\0/g, "").trim();
          let val = p.Property !== undefined ? p.Property : p.Value;
          if (pName === "desiredSlotIndex") {
            slotIndex = Array.isArray(val) ? val[1] : Number(val);
          } else if (pName === "ID") {
            id = (typeof val === "string" ? val : "").replace(/\0/g, "").trim();
          } else if (pName === "quantity") {
            quantity = Array.isArray(val) ? val[1] : Number(val);
          } else if (pName === "charges") {
            charges = Array.isArray(val) ? val[1] : Number(val);
          } else if (pName === "maxCharges") {
            maxCharges = Array.isArray(val) ? val[1] : Number(val);
          }
        }
      }

      return {
        index,
        slotIndex,
        id,
        quantity,
        charges,
        maxCharges,
        _element: el,
      };
    });
  }

  /**
   * Update item quantities in inventory
   * @param {object} root - Gvas or JSON root object
   * @param {Array<{ id?: string, slot?: number, quantity: number }>} updates
   * @returns {Array<{ id: string, slot: number, before: number, after: number }>}
   */
  static setItemQuantities(root, updates = []) {
    let inventory = this.getInventory(root);
    let results = [];

    for (let u of updates) {
      let match = inventory.find((item) => {
        if (u.slot !== undefined && item.slotIndex === Number(u.slot))
          return true;
        if (u.id && item.id.toLowerCase() === u.id.toLowerCase()) return true;
        return false;
      });

      if (match && match._element && match._element.Properties) {
        let qtyProp = match._element.Properties.find(
          (p) => (p.Name || "").replace(/\0/g, "").trim() === "quantity",
        );
        if (qtyProp) {
          let before = match.quantity;
          let toSet = Number(u.quantity);
          qtyProp.Value = toSet;
          if (qtyProp.Property !== undefined) {
            qtyProp.Property = [0, toSet];
          }
          results.push({
            id: match.id,
            slot: match.slotIndex,
            before,
            after: toSet,
          });
        }
      }
    }

    return results;
  }

  /**
   * Add or replace an inventory item slot
   * @param {object} root - Gvas or JSON root object
   * @param {number} slotIndex - Desired slot index (0 to 39)
   * @param {string} itemId - Item ID (e.g. item_65063)
   * @param {number} quantity - Quantity
   */
  static setInventorySlot(root, slotIndex, itemId, quantity = 999) {
    let playerData = this.findPlayerSaveData(root);
    if (!playerData || !playerData.Properties) return false;
    let invProp = playerData.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim().toLowerCase() === "inventory",
    );
    if (!invProp || !invProp.Elements) return false;

    // Check if slot already exists
    let existing = invProp.Elements.find((el) => {
      let sProp = el.Properties?.find(
        (p) => (p.Name || "").replace(/\0/g, "").trim() === "desiredSlotIndex",
      );
      let sVal = sProp
        ? Array.isArray(sProp.Value)
          ? sProp.Value[1]
          : sProp.Value
        : -1;
      return Number(sVal) === Number(slotIndex);
    });

    if (existing) {
      let idProp = existing.Properties.find(
        (p) => (p.Name || "").replace(/\0/g, "").trim() === "ID",
      );
      let qProp = existing.Properties.find(
        (p) => (p.Name || "").replace(/\0/g, "").trim() === "quantity",
      );
      if (idProp)
        idProp.Property = itemId.endsWith("\0") ? itemId : itemId + "\0";
      if (qProp) qProp.Value = Number(quantity);
      return true;
    }

    // Find a template element to clone
    let template = invProp.Elements[0];
    let clone = JSON.parse(JSON.stringify(template));
    for (let p of clone.Properties) {
      let pName = (p.Name || "").replace(/\0/g, "").trim();
      if (pName === "desiredSlotIndex") p.Value = Number(slotIndex);
      else if (pName === "ID")
        p.Property = itemId.endsWith("\0") ? itemId : itemId + "\0";
      else if (pName === "quantity") p.Value = Number(quantity);
      else if (pName === "objectData") {
        p.Count = 0;
        p.Elements = [];
        p.RawData = "";
      }
    }

    let finalElement =
      typeof template.serialize === "function"
        ? PropertyFactory.create(clone)
        : clone;
    invProp.Elements.push(finalElement);
    invProp.Elements.sort((a, b) => {
      let sa =
        a.Properties?.find(
          (p) =>
            (p.Name || "").replace(/\0/g, "").trim() === "desiredSlotIndex",
        )?.Value || 0;
      let sb =
        b.Properties?.find(
          (p) =>
            (p.Name || "").replace(/\0/g, "").trim() === "desiredSlotIndex",
        )?.Value || 0;
      return Number(sa) - Number(sb);
    });

    return true;
  }

  static ALL_WAYPOINTS = [
    { id: "Farm", nameId: "Perkebunan (Farm)", nameEn: "Farm" },
    { id: "town", nameId: "Pusat Kota (Starlet Town)", nameEn: "Starlet Town" },
    { id: "museum", nameId: "Museum", nameEn: "Museum" },
    { id: "beach", nameId: "Pantai (Beach)", nameEn: "Beach" },
    { id: "lookout", nameId: "Menara Pantau (Lookout)", nameEn: "Lookout" },
    {
      id: "LakeTemple",
      nameId: "Kuil Danau (Lake Temple)",
      nameEn: "Lake Temple",
    },
    {
      id: "ForestCavern",
      nameId: "Tambang Hutan (Cavern)",
      nameEn: "Forest Cavern",
    },
    {
      id: "giantVillage",
      nameId: "Desa Raksasa (Giant Village)",
      nameEn: "Giant Village",
    },
    { id: "Woodlands", nameId: "Hutan Dalam (Woodlands)", nameEn: "Woodlands" },
    {
      id: "SavannahLower",
      nameId: "Sabana Bawah (Savannah Lower)",
      nameEn: "Savannah Lower",
    },
    {
      id: "SavannahUpper",
      nameId: "Sabana Atas (Savannah Upper)",
      nameEn: "Savannah Upper",
    },
    {
      id: "divingPier",
      nameId: "Dermaga Selam (Diving Pier)",
      nameEn: "Diving Pier",
    },
    { id: "Diving10m", nameId: "Laut Kedalaman 10m", nameEn: "Diving 10m" },
    { id: "Diving20m", nameId: "Laut Kedalaman 20m", nameEn: "Diving 20m" },
    { id: "Diving40m", nameId: "Laut Kedalaman 40m", nameEn: "Diving 40m" },
    { id: "Diving50m", nameId: "Laut Kedalaman 50m", nameEn: "Diving 50m" },
    {
      id: "MerfolkKingdom",
      nameId: "Kerajaan Duyung (Merfolk Kingdom)",
      nameEn: "Merfolk Kingdom",
    },
    {
      id: "UnderwaterFarm",
      nameId: "Perkebunan Bawah Laut (Underwater Farm)",
      nameEn: "Underwater Farm",
    },
  ];

  static findSaveData(root) {
    let target = null;
    function traverse(node) {
      if (!node || typeof node !== "object" || target) return;
      let structType = (node.StoredPropertyType || "")
        .replace(/\0/g, "")
        .trim();
      let name = (node.Name || "").replace(/\0/g, "").trim();

      if (structType === "C_SaveData" || name === "saveData") {
        target = node;
        return;
      }

      if (Array.isArray(node)) {
        for (let item of node) traverse(item);
      } else {
        for (let key of Object.keys(node)) traverse(node[key]);
      }
    }
    traverse(root);
    return target;
  }

  static getIntProp(structNode, propName, defaultVal = 0) {
    if (!structNode?.Properties) return defaultVal;
    const prop = structNode.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim().toLowerCase() ===
        propName.toLowerCase(),
    );
    if (!prop) return defaultVal;
    if (prop.Value !== undefined) return Number(prop.Value);
    if (Array.isArray(prop.Property)) return Number(prop.Property[1]);
    if (prop.Property !== undefined) return Number(prop.Property);
    return defaultVal;
  }

  static setIntProp(structNode, propName, newValue) {
    if (!structNode?.Properties) return false;
    const num = Number(newValue);
    const prop = structNode.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim().toLowerCase() ===
        propName.toLowerCase(),
    );
    if (!prop) {
      const raw = {
        Name: propName.endsWith("\0") ? propName : propName + "\0",
        Type: "IntProperty\0",
        ArrayIndex: 0,
        HasPropertyGuid: 0,
        Value: num,
        Property: [0, num],
      };
      const isLiveGvas = structNode.Properties.some(
        (p) => typeof p?.serialize === "function",
      );
      structNode.Properties.push(
        isLiveGvas ? PropertyFactory.create(raw) : raw,
      );
      return true;
    }
    if (prop.Value !== undefined) prop.Value = num;
    if (Array.isArray(prop.Property)) {
      prop.Property = [prop.ArrayIndex || 0, num];
    } else if (
      prop.Property !== undefined &&
      typeof prop.Property === "number"
    ) {
      prop.Property = num;
    }
    return true;
  }

  static setEnumProp(structNode, propName, enumType, newValue) {
    if (!structNode?.Properties) return false;
    if (this.setPropValue(structNode, propName, newValue)) {
      return true;
    }
    const cleanVal = String(newValue).endsWith("\0")
      ? String(newValue)
      : String(newValue) + "\0";
    const cleanEnum = String(enumType).endsWith("\0")
      ? String(enumType)
      : String(enumType) + "\0";
    const raw = {
      Name: propName.endsWith("\0") ? propName : propName + "\0",
      Type: "EnumProperty\0",
      EnumType: cleanEnum,
      ArrayIndex: 0,
      HasPropertyGuid: 0,
      Property: cleanVal,
    };
    const isLiveGvas = structNode.Properties.some(
      (p) => typeof p?.serialize === "function",
    );
    structNode.Properties.push(isLiveGvas ? PropertyFactory.create(raw) : raw);
    return true;
  }

  static getPlayerStats(root) {
    const pData = this.findPlayerSaveData(root);
    return {
      gold: this.getIntProp(pData, "playerCurrentGold", 0),
      meritPoints: this.getIntProp(pData, "playerCurrentMeritPoint", 0),
      staminaFruit: this.getIntProp(pData, "staminaFruit", 0),
      wellnessFruit: this.getIntProp(pData, "wellnessFruit", 0),
      inventoryLimit: this.getIntProp(pData, "inventoryLimit", 20),
    };
  }

  static editPlayerStats(root, options = {}) {
    const pData = this.findPlayerSaveData(root);
    if (!pData) return false;

    if (options.gold !== undefined) {
      this.setIntProp(pData, "playerCurrentGold", options.gold);
    }
    if (options.meritPoints !== undefined) {
      this.setIntProp(pData, "playerCurrentMeritPoint", options.meritPoints);
    }
    if (options.staminaFruit !== undefined) {
      this.setIntProp(pData, "staminaFruit", options.staminaFruit);
    }
    if (options.wellnessFruit !== undefined) {
      this.setIntProp(pData, "wellnessFruit", options.wellnessFruit);
    }
    if (options.inventoryLimit !== undefined) {
      this.setIntProp(pData, "inventoryLimit", options.inventoryLimit);
    }
    return this.getPlayerStats(root);
  }

  static getWorldData(root) {
    const saveData = this.findSaveData(root);
    if (!saveData?.Properties) {
      return {
        season: "EC_Season::Spring",
        day: 1,
        year: 1,
        currentWeather: "EC_Weather::Sunny",
        weatherForecast: "EC_Weather::Sunny",
        townRank: 0,
        overallTownPoint: 0,
        currentTownPoint: 0,
        waypoints: [],
      };
    }

    const curDate = saveData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "currentDate",
    );
    const day = this.getIntProp(curDate, "day", 1);
    const year = this.getIntProp(curDate, "year", 1);
    const season = this.getPropValue(curDate, "season") || "EC_Season::Spring";

    const currentWeather =
      this.getPropValue(saveData, "currentWeather") || "EC_Weather::Sunny";
    const weatherForecast =
      this.getPropValue(saveData, "weatherForecast") || "EC_Weather::Sunny";

    const townRankData = saveData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "townRankData",
    );
    const overallTownPoint = this.getIntProp(
      townRankData,
      "overallTownPoint",
      0,
    );
    const currentTownPoint = this.getIntProp(
      townRankData,
      "currentTownPoint",
      0,
    );
    const currentRank = this.getIntProp(townRankData, "currentRank", 0);

    const ftpProp = saveData.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim() === "unlockedFastTravelPoints",
    );
    const waypoints = Array.isArray(ftpProp?.Entries)
      ? ftpProp.Entries.map((e) => (e || "").replace(/\0/g, "").trim()).filter(
          Boolean,
        )
      : [];

    return {
      day,
      season,
      year,
      currentWeather,
      weatherForecast,
      townRank: currentRank,
      overallTownPoint,
      currentTownPoint,
      waypoints,
    };
  }

  static editWorldData(root, options = {}) {
    const saveData = this.findSaveData(root);
    if (!saveData?.Properties) return null;

    const curDate = saveData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "currentDate",
    );
    if (curDate) {
      if (options.day !== undefined) {
        const clampedDay = Math.max(1, Math.min(28, Number(options.day) || 1));
        this.setIntProp(curDate, "day", clampedDay);
      }
      if (options.season !== undefined) {
        let s = String(options.season).replace(/\0/g, "").trim();
        if (!s.startsWith("EC_Season::")) {
          s = `EC_Season::${s}`;
        }
        this.setEnumProp(curDate, "season", "EC_Season", s);
      }
      if (options.year !== undefined) {
        this.setIntProp(
          curDate,
          "year",
          Math.max(1, Number(options.year) || 1),
        );
      }
    }

    if (options.currentWeather !== undefined) {
      let w = String(options.currentWeather).replace(/\0/g, "").trim();
      if (!w.startsWith("EC_Weather::")) w = `EC_Weather::${w}`;
      this.setEnumProp(saveData, "currentWeather", "EC_Weather", w);
    }

    if (options.weatherForecast !== undefined) {
      let wf = String(options.weatherForecast).replace(/\0/g, "").trim();
      if (!wf.startsWith("EC_Weather::")) wf = `EC_Weather::${wf}`;
      this.setEnumProp(saveData, "weatherForecast", "EC_Weather", wf);
    }

    const townRankData = saveData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "townRankData",
    );
    if (townRankData) {
      if (options.overallTownPoint !== undefined) {
        this.setIntProp(
          townRankData,
          "overallTownPoint",
          Math.max(0, Number(options.overallTownPoint) || 0),
        );
      }
      if (options.currentTownPoint !== undefined) {
        this.setIntProp(
          townRankData,
          "currentTownPoint",
          Math.max(0, Number(options.currentTownPoint) || 0),
        );
      }
      if (options.townRank !== undefined) {
        const clampedRank = Math.max(
          0,
          Math.min(6, Number(options.townRank) || 0),
        );
        const rankProp = townRankData.Properties?.find(
          (p) => (p.Name || "").replace(/\0/g, "").trim() === "currentRank",
        );
        if (rankProp) {
          rankProp.Property = clampedRank;
        } else if (townRankData.Properties) {
          const raw = {
            Name: "currentRank\0",
            Type: "ByteProperty\0",
            EnumName: "None\0",
            ArrayIndex: 0,
            HasPropertyGuid: 0,
            Property: clampedRank,
          };
          const isLiveGvas = townRankData.Properties.some(
            (p) => typeof p?.serialize === "function",
          );
          townRankData.Properties.push(
            isLiveGvas ? PropertyFactory.create(raw) : raw,
          );
        }
      }
    }

    if (Array.isArray(options.waypoints)) {
      const ftpProp = saveData.Properties.find(
        (p) =>
          (p.Name || "").replace(/\0/g, "").trim() ===
          "unlockedFastTravelPoints",
      );
      if (ftpProp && !ftpProp.RawData) {
        const unique = Array.from(
          new Set(
            options.waypoints
              .map((w) => String(w).replace(/\0/g, "").trim())
              .filter(Boolean),
          ),
        );
        ftpProp.Entries = unique.map((w) => w + "\0");
      }
    }

    return this.getWorldData(root);
  }

  static unlockAllWaypoints(root) {
    const current = this.getWorldData(root);
    const merged = Array.from(
      new Set([
        ...(current?.waypoints || []),
        ...this.ALL_WAYPOINTS.map((w) => w.id),
      ]),
    );
    return this.editWorldData(root, { waypoints: merged });
  }

  static ROMANCEABLE_NPCS = new Set([
    "aaliyah",
    "agung",
    "alice",
    "ben",
    "chaem",
    "charles",
    "denali",
    "eva",
    "kenny",
    "leah",
    "lily",
    "luke",
    "macy",
    "mark",
    "millie",
    "miranjani",
    "princessmiranjani",
    "nina",
    "noah",
    "pablo",
    "rafael",
    "raj",
    "scott",
    "semih",
    "suki",
    "surya",
    "theo",
    "wakuu",
    "yuri",
    "zarah",
  ]);

  static NPC_DISPLAY_NAMES = {
    aaliyah: "Aaliyah",
    agung: "Agung",
    alice: "Alice",
    anne: "Anne",
    antonio: "Antonio",
    archie: "Archie",
    ben: "Ben",
    betty: "Betty",
    bonbon: "Bonbon",
    bree: "Bree",
    butter: "Butter",
    chaem: "Chaem",
    charles: "Charles",
    cho: "Cho Oyu",
    chooyu: "Cho Oyu",
    connor: "Connor",
    denali: "Denali",
    dinda: "Dinda",
    dippa: "Dippa",
    leanor: "Eleanor",
    eleanor: "Eleanor",
    emily: "Emily",
    emma: "Emma",
    erika: "Erika",
    eva: "Eva",
    frank: "Frank",
    gedy: "Gedy",
    gong: "Gong",
    grog: "Grog",
    groo: "Groo",
    jack: "Jack",
    jeff: "Jeff Smith",
    jim: "Jim",
    joko: "Joko",
    judge: "Judge Ross",
    kenny: "Kenny",
    kible: "Kibble",
    kira: "Kira",
    leah: "Leah",
    lily: "Lily",
    ling: "Ling",
    luke: "Luke",
    macy: "Macy",
    mark: "Mark",
    millie: "Millie",
    miranjani: "Princess Miranjani",
    princessmiranjani: "Princess Miranjani",
    nina: "Nina",
    noah: "Noah",
    oliver: "Oliver",
    pablo: "Pablo",
    paul: "Paul",
    peanut: "Peanut",
    rafael: "Rafael",
    raina: "Raina",
    raj: "Raj",
    randy: "Randy",
    ratih: "Ratih",
    sam: "Sam",
    scott: "Scott",
    semih: "Semih",
    suki: "Suki",
    sunny: "Sunny",
    surya: "Surya",
    taco: "Taco",
    takeba: "Takeba",
    theo: "Theo",
    valentina: "Valentina",
    wakuu: "Wakuu",
    wakwat: "Wataru",
    wataru: "Wataru",
    walter: "Walter",
    yuri: "Yuri",
    zarah: "Zarah",
    zoe: "Zoey",
    zoey: "Zoey",
  };

  static formatNpcName(npcId) {
    const clean = (npcId || "").replace(/\0/g, "").trim();
    const lower = clean.toLowerCase();
    if (this.NPC_DISPLAY_NAMES[lower]) {
      return this.NPC_DISPLAY_NAMES[lower];
    }
    return clean
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (str) => str.toUpperCase());
  }

  static isExcludedBackgroundNpc(lowerId) {
    if (!lowerId || lowerId === "none") return true;
    if (lowerId.endsWith("_mirror")) return true;
    if (lowerId.startsWith("merfolktourist")) return true;
    if (lowerId.startsWith("merfolkvillager")) return true;
    if (lowerId.startsWith("merfolk guard")) return true;
    if (lowerId.startsWith("turtle")) return true;
    if (
      lowerId === "reccenterstaff" ||
      lowerId === "mythicalpet" ||
      lowerId === "seal"
    ) {
      return true;
    }
    return false;
  }

  static getNpcRelationships(root) {
    const pData = this.findPlayerSaveData(root);
    if (!pData?.Properties) return [];

    const npcProp = pData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "npcRelationshipData",
    );
    if (!npcProp || !Array.isArray(npcProp.Elements)) return [];

    const list = [];
    for (const el of npcProp.Elements) {
      if (!el?.Properties) continue;
      const id = this.getPropValue(el, "npcId");
      if (!id) continue;

      const lowerId = id.toLowerCase();
      if (this.isExcludedBackgroundNpc(lowerId)) continue;

      const heartPoints = this.getIntProp(el, "heartPoints", 0);
      const hearts = Math.min(10, Math.floor(heartPoints / 400));
      const weeklyGiftsCount = this.getIntProp(el, "weeklyGiftsCount", 0);
      const dailyGiftLeft = this.getIntProp(el, "dailyGiftLeft", 1);
      const relationshipStatus =
        this.getPropValue(el, "relationshipStatus") ||
        "EC_RelationshipStatus::NONE";

      list.push({
        id,
        name: this.formatNpcName(id),
        isRomanceable: this.ROMANCEABLE_NPCS.has(lowerId),
        isMajorTownfolk: Boolean(this.NPC_DISPLAY_NAMES[lowerId]),
        heartPoints,
        hearts,
        weeklyGiftsCount,
        dailyGiftLeft,
        relationshipStatus,
      });
    }

    list.sort((a, b) => {
      if (a.isRomanceable !== b.isRomanceable) {
        return a.isRomanceable ? -1 : 1;
      }
      if (a.isMajorTownfolk !== b.isMajorTownfolk) {
        return a.isMajorTownfolk ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }

  static editNpcRelationships(root, updates = []) {
    const pData = this.findPlayerSaveData(root);
    if (!pData?.Properties || !Array.isArray(updates)) {
      return this.getNpcRelationships(root);
    }

    const npcProp = pData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "npcRelationshipData",
    );
    if (!npcProp || !Array.isArray(npcProp.Elements)) {
      return [];
    }

    const updateMap = new Map();
    for (const u of updates) {
      if (u && u.id) {
        updateMap.set(String(u.id).replace(/\0/g, "").trim().toLowerCase(), u);
      }
    }

    for (const el of npcProp.Elements) {
      if (!el?.Properties) continue;
      const id = this.getPropValue(el, "npcId");
      if (!id) continue;

      const u = updateMap.get(id.toLowerCase());
      if (!u) continue;

      if (u.heartPoints !== undefined) {
        const clampedHp = Math.max(
          0,
          Math.min(4000, Number(u.heartPoints) || 0),
        );
        const newLevel = Math.min(10, Math.floor(clampedHp / 400));
        this.setIntProp(el, "heartPoints", clampedHp);
        this.setIntProp(el, "dayBeginHeartLevel", newLevel);

        const curMax = this.getIntProp(el, "dayBeginMaxHeartLevel", 5);
        if (newLevel > curMax) {
          this.setIntProp(el, "dayBeginMaxHeartLevel", newLevel > 8 ? 10 : 8);
        }
      }

      if (u.weeklyGiftsCount !== undefined) {
        const clampedWeekly = Math.max(
          0,
          Math.min(2, Number(u.weeklyGiftsCount) || 0),
        );
        this.setIntProp(el, "weeklyGiftsCount", clampedWeekly);
      }

      if (u.dailyGiftLeft !== undefined) {
        const clampedDaily = Math.max(
          0,
          Math.min(1, Number(u.dailyGiftLeft) ?? 1),
        );
        this.setIntProp(el, "dailyGiftLeft", clampedDaily);
      }
    }

    return this.getNpcRelationships(root);
  }

  static maxAllNpcHearts(root, { romanceableOnly = false } = {}) {
    const current = this.getNpcRelationships(root);
    const updates = current
      .filter((npc) => !romanceableOnly || npc.isRomanceable)
      .map((npc) => ({
        id: npc.id,
        heartPoints: 4000,
      }));
    return this.editNpcRelationships(root, updates);
  }

  static resetAllNpcGifts(root) {
    const current = this.getNpcRelationships(root);
    const updates = current.map((npc) => ({
      id: npc.id,
      weeklyGiftsCount: 0,
      dailyGiftLeft: 1,
    }));
    return this.editNpcRelationships(root, updates);
  }
}
