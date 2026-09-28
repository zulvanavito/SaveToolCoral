import {
  createApp,
  ref,
  computed,
  onMounted,
  onUnmounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

createApp({
  setup() {
    const fileLoaded = ref(false);
    const fileName = ref("");
    const fileSize = ref(0);
    const isDragging = ref(false);
    const uploading = ref(false);
    const saving = ref(false);
    const hasWorkspaceFile = ref(false);
    const gameSavePath = ref("");
    const pathCopied = ref(false);
    const fileInputRef = ref(null);

    const itemLang = ref("id");
    const activeTab = ref("inventory");

    const player = ref({
      name: "",
      gender: "EC_Gender::Male",
      title: "",
      farmName: "",
      gold: 0,
      meritPoints: 0,
      staminaFruit: 0,
      wellnessFruit: 0,
      inventoryLimit: 40,
    });

    const world = ref({
      day: 1,
      season: "EC_Season::Spring",
      year: 1,
      currentWeather: "EC_Weather::Sunny",
      weatherForecast: "EC_Weather::Sunny",
      townRank: 0,
      overallTownPoint: 0,
      currentTownPoint: 0,
      waypoints: [],
    });

    const allWaypoints = ref([]);
    const npcs = ref([]);
    const npcSearch = ref("");
    const npcFilter = ref("all");
    const npcPage = ref(1);
    const npcPerPage = ref(12);
    const inventory = ref([]);

    const toast = ref({
      show: false,
      message: "",
      type: "success",
    });

    const modal = ref({
      open: false,
      slotIndex: 0,
      searchQuery: "",
      searchResults: [],
      selectedItem: null,
      selectedQuality: "base",
      quantity: 1,
      isSearching: false,
    });

    let searchTimeout = null;

    function showToast(message, type = "success") {
      toast.value = { show: true, message, type };
      setTimeout(() => {
        toast.value.show = false;
      }, 4000);
    }

    function getIconKey(itemOrSlot) {
      if (!itemOrSlot) return "";
      return itemOrSlot.iconKey || itemOrSlot.nameEn || itemOrSlot.name || "";
    }

    function getItemName(itemOrSlot) {
      if (!itemOrSlot || itemOrSlot.empty) return "(Kosong)";
      if (itemLang.value === "id") {
        return (
          itemOrSlot.nameId ||
          itemOrSlot.name ||
          itemOrSlot.nameEn ||
          itemOrSlot.id
        );
      }
      return (
        itemOrSlot.nameEn ||
        itemOrSlot.name ||
        itemOrSlot.nameId ||
        itemOrSlot.id
      );
    }

    function getItemDesc(itemOrSlot) {
      if (!itemOrSlot) return "";
      if (itemLang.value === "id") {
        return (
          itemOrSlot.descId || itemOrSlot.description || itemOrSlot.descEn || ""
        );
      }
      return (
        itemOrSlot.descEn || itemOrSlot.description || itemOrSlot.descId || ""
      );
    }

    const iconMap = ref({});
    const iconStats = ref({ count: 0, totalKB: "0", totalMB: "0" });
    const pendingIconFetches = new Set();

    async function fetchIconStats() {
      try {
        const res = await fetch("/api/icons/stats");
        const data = await res.json();
        if (data.success) {
          iconStats.value = data;
        }
      } catch (err) {
        console.error("Error fetching icon stats:", err);
      }
    }

    async function clearIconCache() {
      try {
        const res = await fetch("/api/icons/clear", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          iconMap.value = {};
          await fetchIconStats();
          showToast("Cache ikon lokal berhasil dibersihkan.");
          resolveBagIcons();
        }
      } catch (err) {
        showToast("Gagal membersihkan cache ikon: " + err.message, "error");
      }
    }

    async function resolveIcons(names = []) {
      const needed = names.filter(
        (n) =>
          n &&
          n !== "(Kosong)" &&
          n !== "(Empty)" &&
          !iconMap.value[n] &&
          !pendingIconFetches.has(n),
      );
      if (needed.length === 0) return;

      needed.forEach((n) => pendingIconFetches.add(n));
      try {
        const res = await fetch("/api/icons/resolve-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: needed }),
        });
        const data = await res.json();
        if (data.success && data.icons) {
          for (const [name, url] of Object.entries(data.icons)) {
            if (url) {
              iconMap.value[name] = url;
            }
          }
        }
      } catch (err) {
        console.error("Error resolving icons:", err);
      } finally {
        needed.forEach((n) => pendingIconFetches.delete(n));
      }
    }

    function resolveBagIcons() {
      if (!inventory.value || !Array.isArray(inventory.value)) return;
      const names = inventory.value
        .filter((s) => !s.empty && getIconKey(s))
        .map((s) => getIconKey(s));
      resolveIcons(names);
    }

    function onImageLoad() {}

    function onImageError(key) {
      if (key) iconMap.value[key] = null;
    }

    function handleKeydown(e) {
      if (e.key === "Escape" && modal.value.open) {
        closeSlotEditor();
      }
    }

    onMounted(async () => {
      window.addEventListener("keydown", handleKeydown);
      try {
        const res = await fetch("/api/save-path");
        const data = await res.json();
        if (data.success) {
          gameSavePath.value = data.path;
        }

        const wsRes = await fetch("/api/load-workspace");
        if (wsRes.ok) {
          hasWorkspaceFile.value = true;
        }

        await fetchIconStats();
      } catch (err) {
        console.error("Init error:", err);
      }
    });

    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeydown);
    });

    function triggerFileInput() {
      if (fileInputRef.value) {
        fileInputRef.value.click();
      }
    }

    function onFileSelected(e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        processUploadedFile(file);
      }
      e.target.value = "";
    }

    function onDragOver(e) {
      e.preventDefault();
      isDragging.value = true;
    }

    function onDragLeave(e) {
      e.preventDefault();
      isDragging.value = false;
    }

    function onFileDrop(e) {
      e.preventDefault();
      isDragging.value = false;
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        processUploadedFile(file);
      }
    }

    function applySavePayload(data) {
      fileName.value = data.filename;
      fileSize.value = data.size;
      player.value = {
        name: data.player?.name || "",
        farmName: data.player?.farmName || "",
        gender: data.player?.gender || "EC_Gender::Male",
        title: data.player?.title || "",
        gold: data.player?.gold ?? 0,
        meritPoints: data.player?.meritPoints ?? 0,
        staminaFruit: data.player?.staminaFruit ?? 0,
        wellnessFruit: data.player?.wellnessFruit ?? 0,
        inventoryLimit: data.player?.inventoryLimit ?? 40,
      };
      if (data.world) {
        world.value = {
          day: data.world.day ?? 1,
          season: data.world.season || "EC_Season::Spring",
          year: data.world.year ?? 1,
          currentWeather: data.world.currentWeather || "EC_Weather::Sunny",
          weatherForecast: data.world.weatherForecast || "EC_Weather::Sunny",
          townRank: data.world.townRank ?? 0,
          overallTownPoint: data.world.overallTownPoint ?? 0,
          currentTownPoint: data.world.currentTownPoint ?? 0,
          waypoints: Array.isArray(data.world.waypoints)
            ? [...data.world.waypoints]
            : [],
        };
      }
      if (Array.isArray(data.allWaypoints)) {
        allWaypoints.value = data.allWaypoints;
      }
      npcs.value = Array.isArray(data.npcs) ? data.npcs : [];
      inventory.value = data.inventory || [];
      fileLoaded.value = true;
      resolveBagIcons();
    }

    async function processUploadedFile(file) {
      if (!file.name.toLowerCase().endsWith(".sav")) {
        showToast(
          "Harap pilih file dengan ekstensi .sav (Unreal Engine Save)",
          "error",
        );
        return;
      }

      uploading.value = true;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Filename": encodeURIComponent(file.name),
          },
          body: file,
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        applySavePayload(data);
        showToast(`File ${data.filename} berhasil dimuat.`);
      } catch (err) {
        showToast("Gagal memproses file: " + err.message, "error");
      } finally {
        uploading.value = false;
      }
    }

    async function loadWorkspaceSave() {
      uploading.value = true;
      try {
        const res = await fetch("/api/load-workspace");
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        applySavePayload(data);
        showToast("ManualSave0.sav dari workspace berhasil dimuat.");
      } catch (err) {
        showToast("Gagal memuat save workspace: " + err.message, "error");
      } finally {
        uploading.value = false;
      }
    }

    function resetCurrentFile() {
      fileLoaded.value = false;
      fileName.value = "";
      fileSize.value = 0;
      npcs.value = [];
      inventory.value = [];
    }

    async function downloadSave() {
      if (!fileLoaded.value) return;
      saving.value = true;
      try {
        const saveRes = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: player.value,
            world: world.value,
            npcs: npcs.value,
            inventory: inventory.value,
          }),
        });

        const saveData = await saveRes.json();
        if (!saveData.success) throw new Error(saveData.error);

        const a = document.createElement("a");
        a.href = "/api/download";
        a.download = fileName.value || "ManualSave0.sav";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast("File save tervalidasi dan berhasil diunduh.");
      } catch (err) {
        showToast("Gagal mengunduh save: " + err.message, "error");
      } finally {
        saving.value = false;
      }
    }

    function copyGamePath() {
      if (gameSavePath.value) {
        navigator.clipboard.writeText(gameSavePath.value);
        pathCopied.value = true;
        setTimeout(() => {
          pathCopied.value = false;
        }, 3000);
      }
    }

    const rowHotbar = computed(() => inventory.value.slice(0, 10));
    const rowBag1 = computed(() => inventory.value.slice(10, 20));
    const rowBag2 = computed(() => inventory.value.slice(20, 30));
    const rowBag3 = computed(() => inventory.value.slice(30, 40));

    function isTool(id) {
      if (!id) return false;
      const lower = id.toLowerCase();
      return (
        lower.includes("tool") ||
        lower.includes("pickaxe") ||
        lower.includes("axe") ||
        lower.includes("hoe") ||
        lower.includes("watering") ||
        lower.includes("scythe") ||
        lower.includes("pole") ||
        lower.includes("rod") ||
        lower.includes("net") ||
        lower.includes("sword")
      );
    }

    function openSlotEditor(slot) {
      modal.value.slotIndex = slot.slotIndex;
      modal.value.quantity = slot.empty ? 1 : slot.quantity || 1;
      modal.value.selectedQuality = slot.quality || "base";
      modal.value.open = true;

      if (!slot.empty) {
        const display = getItemName(slot);
        modal.value.searchQuery = display;
        modal.value.selectedItem = {
          baseId: slot.id.replace(/-[a-d]$/, ""),
          name: slot.name,
          nameId: slot.nameId || slot.name,
          nameEn: slot.nameEn || slot.name,
          descId: slot.descId || "",
          descEn: slot.descEn || "",
          iconKey: getIconKey(slot),
          category: slot.category,
          hasQualities: slot.hasQualities,
          qualities: slot.availableQualities,
        };
      } else {
        modal.value.searchQuery = "";
        modal.value.selectedItem = null;
      }

      searchItems(modal.value.searchQuery || "");
    }

    function closeSlotEditor() {
      modal.value.open = false;
    }

    async function searchItems(q = "") {
      modal.value.isSearching = true;
      try {
        const res = await fetch(
          `/api/items?q=${encodeURIComponent(q)}&limit=40`,
        );
        const data = await res.json();
        if (data.success) {
          modal.value.searchResults = data.items;
          resolveIcons(data.items.map((it) => getIconKey(it)));
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        modal.value.isSearching = false;
      }
    }

    function onSearchInput() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchItems(modal.value.searchQuery);
      }, 200);
    }

    function selectItem(item) {
      modal.value.selectedItem = item;
      if (item.qualities?.osmium && modal.value.selectedQuality === "osmium") {
        modal.value.selectedQuality = "osmium";
      } else if (!item.qualities?.[modal.value.selectedQuality]) {
        modal.value.selectedQuality = "base";
      }
    }

    const currentComputedId = computed(() => {
      const it = modal.value.selectedItem;
      if (!it) return "";
      const q = modal.value.selectedQuality;
      if (it.qualities && it.qualities[q]) {
        return it.qualities[q];
      }
      return it.baseId;
    });

    function applySlotChanges() {
      if (!modal.value.selectedItem) return;
      const idx = modal.value.slotIndex;
      const targetSlot = inventory.value[idx];
      const appliedId = currentComputedId.value;
      const it = modal.value.selectedItem;

      targetSlot.id = appliedId;
      targetSlot.name = it.nameId || it.name;
      targetSlot.nameId = it.nameId || it.name;
      targetSlot.nameEn = it.nameEn || it.name;
      targetSlot.descId = it.descId || "";
      targetSlot.descEn = it.descEn || "";
      targetSlot.iconKey = getIconKey(it);
      targetSlot.category = it.category;
      targetSlot.quantity = Math.max(
        1,
        Math.min(999, Number(modal.value.quantity) || 1),
      );
      targetSlot.quality =
        it.qualities && it.qualities[modal.value.selectedQuality]
          ? modal.value.selectedQuality
          : "base";
      targetSlot.hasQualities = it.hasQualities;
      targetSlot.availableQualities = it.qualities;
      targetSlot.empty = false;

      resolveIcons([targetSlot.iconKey]);
      closeSlotEditor();
      showToast(
        `Slot #${idx + 1} diperbarui: ${getItemName(targetSlot)} (${targetSlot.quantity})`,
      );
    }

    function clearSlot() {
      const idx = modal.value.slotIndex;
      const targetSlot = inventory.value[idx];
      targetSlot.id = "";
      targetSlot.name = "(Kosong)";
      targetSlot.nameId = "(Kosong)";
      targetSlot.nameEn = "(Empty)";
      targetSlot.descId = "";
      targetSlot.descEn = "";
      targetSlot.iconKey = "";
      targetSlot.category = "Empty";
      targetSlot.quantity = 0;
      targetSlot.quality = "base";
      targetSlot.hasQualities = false;
      targetSlot.availableQualities = { base: "" };
      targetSlot.empty = true;

      closeSlotEditor();
      showToast(`Slot #${idx + 1} dikosongkan.`);
    }

    function setQty(val) {
      modal.value.quantity = Math.max(1, Math.min(999, val));
    }

    function addQty(delta) {
      modal.value.quantity = Math.max(
        1,
        Math.min(999, (Number(modal.value.quantity) || 1) + delta),
      );
    }

    function addGold(amount) {
      player.value.gold = Math.max(0, Number(player.value.gold || 0) + amount);
      showToast(`Gold ditambah +${amount.toLocaleString()}`);
    }

    function addMerit(amount) {
      player.value.meritPoints = Math.max(
        0,
        Number(player.value.meritPoints || 0) + amount,
      );
      showToast(`Merit Points ditambah +${amount.toLocaleString()}`);
    }

    function setMaxBag() {
      player.value.inventoryLimit = 40;
      showToast("Kapasitas tas diatur ke maksimum (40 Slot).");
    }

    function setTownRankPreset(rankVal, pointsVal, label) {
      world.value.townRank = rankVal;
      world.value.overallTownPoint = pointsVal;
      world.value.currentTownPoint = pointsVal;
      showToast(
        `Town Rank diatur ke ${label} (${pointsVal.toLocaleString()} poin).`,
      );
    }

    function isWaypointUnlocked(id) {
      return (
        Array.isArray(world.value.waypoints) &&
        world.value.waypoints.includes(id)
      );
    }

    function toggleWaypoint(id) {
      if (!Array.isArray(world.value.waypoints)) {
        world.value.waypoints = [];
      }
      const idx = world.value.waypoints.indexOf(id);
      if (idx === -1) {
        world.value.waypoints.push(id);
      } else {
        world.value.waypoints.splice(idx, 1);
      }
    }

    function unlockAllWaypoints() {
      const existing = Array.isArray(world.value.waypoints)
        ? world.value.waypoints
        : [];
      const allIds = allWaypoints.value.map((w) => w.id);
      world.value.waypoints = Array.from(new Set([...existing, ...allIds]));
      showToast(`Seluruh ${allIds.length} titik teleport berhasil dibuka.`);
    }

    const filteredNpcs = computed(() => {
      const q = (npcSearch.value || "").toLowerCase().trim();
      return npcs.value.filter((n) => {
        if (npcFilter.value === "romanceable" && !n.isRomanceable) return false;
        if (npcFilter.value === "townfolk" && n.isRomanceable) return false;
        if (!q) return true;
        return (
          (n.name || "").toLowerCase().includes(q) ||
          (n.id || "").toLowerCase().includes(q)
        );
      });
    });

    const npcTotalPages = computed(() =>
      Math.max(1, Math.ceil(filteredNpcs.value.length / npcPerPage.value)),
    );

    const safeNpcPage = computed(() =>
      Math.min(Math.max(1, npcPage.value), npcTotalPages.value),
    );

    const paginatedNpcs = computed(() => {
      const start = (safeNpcPage.value - 1) * npcPerPage.value;
      return filteredNpcs.value.slice(start, start + npcPerPage.value);
    });

    const npcRangeStart = computed(() =>
      filteredNpcs.value.length === 0
        ? 0
        : (safeNpcPage.value - 1) * npcPerPage.value + 1,
    );

    const npcRangeEnd = computed(() =>
      Math.min(filteredNpcs.value.length, safeNpcPage.value * npcPerPage.value),
    );

    const npcPageNumbers = computed(() => {
      const total = npcTotalPages.value;
      const cur = safeNpcPage.value;
      const maxButtons = 7;
      if (total <= maxButtons) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      let start = Math.max(1, cur - 3);
      let end = Math.min(total, start + maxButtons - 1);
      if (end - start + 1 < maxButtons) {
        start = Math.max(1, end - maxButtons + 1);
      }
      const pages = [];
      for (let i = start; i <= end; i++) pages.push(i);
      return pages;
    });

    function setNpcFilter(f) {
      npcFilter.value = f;
      npcPage.value = 1;
    }

    function onNpcSearchInput() {
      npcPage.value = 1;
    }

    function goToNpcPage(p) {
      npcPage.value = Math.max(
        1,
        Math.min(npcTotalPages.value, Number(p) || 1),
      );
    }

    function setNpcPerPage(size) {
      npcPerPage.value = Number(size) || 12;
      npcPage.value = 1;
    }

    function setNpcHearts(npc, heartsCount) {
      const pts = Math.max(0, Math.min(4000, Number(heartsCount) * 400));
      npc.heartPoints = pts;
      npc.hearts = Math.min(10, Math.floor(pts / 400));
    }

    function onNpcPointsInput(npc) {
      const pts = Math.max(0, Math.min(4000, Number(npc.heartPoints) || 0));
      npc.heartPoints = pts;
      npc.hearts = Math.min(10, Math.floor(pts / 400));
    }

    function resetNpcGift(npc) {
      npc.weeklyGiftsCount = 0;
      npc.dailyGiftLeft = 1;
      showToast(`Kuota hadiah ${npc.name} berhasil direset.`);
    }

    function maxAllNpcHearts(romanceableOnly = false) {
      let count = 0;
      for (const n of npcs.value) {
        if (romanceableOnly && !n.isRomanceable) continue;
        n.heartPoints = 4000;
        n.hearts = 10;
        count++;
      }
      showToast(
        romanceableOnly
          ? `${count} karakter Romanceable diatur ke 10 Hati (4.000 poin).`
          : `Seluruh ${count} NPC diatur ke 10 Hati (4.000 poin).`,
      );
    }

    function resetAllNpcGifts() {
      for (const n of npcs.value) {
        n.weeklyGiftsCount = 0;
        n.dailyGiftLeft = 1;
      }
      showToast(
        `Kuota hadiah mingguan dan harian seluruh ${npcs.value.length} NPC berhasil direset.`,
      );
    }

    return {
      fileLoaded,
      fileName,
      fileSize,
      isDragging,
      uploading,
      saving,
      hasWorkspaceFile,
      gameSavePath,
      pathCopied,
      fileInputRef,
      itemLang,
      activeTab,
      player,
      world,
      allWaypoints,
      npcs,
      npcSearch,
      npcFilter,
      npcPage,
      npcPerPage,
      filteredNpcs,
      paginatedNpcs,
      npcTotalPages,
      safeNpcPage,
      npcRangeStart,
      npcRangeEnd,
      npcPageNumbers,
      inventory,
      toast,
      modal,
      rowHotbar,
      rowBag1,
      rowBag2,
      rowBag3,
      currentComputedId,
      iconMap,
      iconStats,
      getIconKey,
      getItemName,
      getItemDesc,
      fetchIconStats,
      clearIconCache,
      onImageLoad,
      onImageError,
      triggerFileInput,
      onFileSelected,
      onDragOver,
      onDragLeave,
      onFileDrop,
      loadWorkspaceSave,
      resetCurrentFile,
      downloadSave,
      copyGamePath,
      isTool,
      openSlotEditor,
      closeSlotEditor,
      onSearchInput,
      selectItem,
      applySlotChanges,
      clearSlot,
      setQty,
      addQty,
      addGold,
      addMerit,
      setMaxBag,
      setTownRankPreset,
      isWaypointUnlocked,
      toggleWaypoint,
      unlockAllWaypoints,
      setNpcFilter,
      onNpcSearchInput,
      goToNpcPage,
      setNpcPerPage,
      setNpcHearts,
      onNpcPointsInput,
      resetNpcGift,
      maxAllNpcHearts,
      resetAllNpcGifts,
    };
  },
}).mount("#app");
