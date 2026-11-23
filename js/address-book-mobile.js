(function () {
  "use strict";

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
  const PINYIN_BOUNDARIES = [
    ["A", "阿"], ["B", "芭"], ["C", "擦"], ["D", "搭"], ["E", "蛾"], ["F", "发"],
    ["G", "噶"], ["H", "哈"], ["J", "击"], ["K", "喀"], ["L", "垃"], ["M", "妈"],
    ["N", "拿"], ["O", "哦"], ["P", "啪"], ["Q", "期"], ["R", "然"], ["S", "撒"],
    ["T", "塌"], ["W", "挖"], ["X", "昔"], ["Y", "压"], ["Z", "匝"]
  ];
  const pinyinCollator = new Intl.Collator("zh-CN-u-co-pinyin", { sensitivity: "base" });

  const state = {
    organizations: [],
    contacts: [],
    selectedOrgId: "all",
    draftOrgId: "all",
    expandedOrgIds: new Set(["company"]),
    query: "",
    activeLetter: "",
    availableLetters: new Set()
  };

  const dom = {};
  let searchTimer;
  let scrollFrame;

  document.addEventListener("DOMContentLoaded", initMobileAddressBook);

  async function initMobileAddressBook() {
    cacheDom();
    bindEvents();
    renderAlphabetIndex();
    setLoading(true);
    try {
      const [tree, result] = await Promise.all([
        window.ContactApi.getOrganizationTree(),
        window.ContactApi.queryContacts({ orgId: "all", includeChildren: true, pageNo: 1, pageSize: 10000 })
      ]);
      state.organizations = tree;
      state.contacts = result.list.map(normalizeContact);
      renderOrganizationTree();
      applyFilters();
    } catch (error) {
      state.contacts = [];
      applyFilters();
      console.error("移动端通讯录加载失败", error);
    } finally {
      setLoading(false);
    }
  }

  function cacheDom() {
    ["mobileBackButton", "mobileSearchInput", "mobileOrgTrigger", "mobileOrgText", "mobileResultCount", "mobileLoading", "mobileContactList", "mobileEmpty", "mobileAlphabetIndex", "mobileOrgOverlay", "mobileSheetClose", "mobileOrgTree", "mobileOrgReset", "mobileOrgConfirm"].forEach(id => {
      dom[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    dom.mobileBackButton.addEventListener("click", goBack);
    dom.mobileSearchInput.addEventListener("input", event => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = event.target.value.trim().toLowerCase();
        applyFilters();
      }, 120);
    });
    dom.mobileOrgTrigger.addEventListener("click", openOrganizationSheet);
    dom.mobileSheetClose.addEventListener("click", closeOrganizationSheet);
    dom.mobileOrgOverlay.addEventListener("click", event => {
      if (event.target === dom.mobileOrgOverlay) closeOrganizationSheet();
    });
    dom.mobileOrgReset.addEventListener("click", () => {
      state.draftOrgId = "all";
      renderOrganizationTree();
    });
    dom.mobileOrgConfirm.addEventListener("click", confirmOrganization);
    window.addEventListener("scroll", handleDocumentScroll, { passive: true });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !dom.mobileOrgOverlay.hidden) closeOrganizationSheet();
    });
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "./mobile-portal.html#apps";
  }

  function normalizeContact(contact) {
    const departmentId = contact.departmentId || contact.orgId;
    const organization = findOrganization(departmentId);
    const initial = /^[A-Z#]$/.test(contact.nameInitial || "") ? contact.nameInitial : getNameInitial(contact.name);
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone || contact.mobile || "",
      position: contact.position || contact.positionName || "",
      departmentId,
      departmentName: contact.departmentName || (organization ? organization.name : ""),
      departmentPath: contact.departmentPath || contact.orgPath || "",
      employmentStatus: contact.employmentStatus || contact.status || "在岗",
      namePinyin: contact.namePinyin || `${initial}${contact.name}`,
      nameInitial: initial
    };
  }

  function getNameInitial(name) {
    const first = String(name || "").trim().charAt(0);
    if (!first) return "#";
    if (/^[A-Za-z]$/.test(first)) return first.toUpperCase();
    for (let index = PINYIN_BOUNDARIES.length - 1; index >= 0; index -= 1) {
      if (pinyinCollator.compare(first, PINYIN_BOUNDARIES[index][1]) >= 0) return PINYIN_BOUNDARIES[index][0];
    }
    return "#";
  }

  function applyFilters() {
    const scope = state.selectedOrgId === "all" ? null : new Set(collectOrganizationIds(findOrganization(state.selectedOrgId)));
    const filtered = state.contacts
      .filter(contact => contact.employmentStatus === "在岗")
      .filter(contact => !scope || scope.has(contact.departmentId))
      .filter(contact => !state.query || [contact.name, contact.phone, contact.position].some(value => String(value || "").toLowerCase().includes(state.query)))
      .sort((a, b) => pinyinCollator.compare(a.name, b.name));
    renderContacts(filtered);
    dom.mobileResultCount.textContent = `共 ${filtered.length} 人`;
    dom.mobileEmpty.hidden = filtered.length !== 0;
  }

  function renderContacts(contacts) {
    dom.mobileContactList.innerHTML = "";
    const groups = new Map();
    contacts.forEach(contact => {
      const letter = LETTERS.includes(contact.nameInitial) ? contact.nameInitial : "#";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(contact);
    });
    state.availableLetters = new Set(groups.keys());

    LETTERS.forEach(letter => {
      const groupContacts = groups.get(letter);
      if (!groupContacts || !groupContacts.length) return;
      const section = document.createElement("section");
      section.className = "mobile-group";
      section.id = `mobile-group-${letter === "#" ? "hash" : letter}`;
      section.dataset.letter = letter;
      const title = document.createElement("h2");
      title.className = "mobile-group-title";
      title.textContent = letter;
      section.appendChild(title);
      groupContacts.forEach(contact => section.appendChild(createContactRow(contact)));
      dom.mobileContactList.appendChild(section);
    });
    state.activeLetter = groups.keys().next().value || "";
    updateAlphabetIndex();
  }

  function createContactRow(contact) {
    const article = document.createElement("article");
    article.className = "mobile-person";
    const copy = document.createElement("div");
    copy.className = "mobile-person-copy";
    const name = document.createElement("h3");
    name.className = "mobile-person-name";
    name.textContent = contact.name;
    const department = document.createElement("p");
    department.className = "mobile-person-department";
    department.textContent = contact.departmentPath.replace(/-/g, " - ");
    department.title = contact.departmentPath;
    const position = document.createElement("p");
    position.className = "mobile-person-position";
    position.textContent = contact.position;
    copy.append(name, department, position);

    const call = document.createElement("a");
    call.className = "mobile-call";
    call.href = `tel:${contact.phone}`;
    call.setAttribute("aria-label", `拨打${contact.name}的电话 ${contact.phone}`);
    call.title = contact.phone;
    call.innerHTML = `<svg aria-hidden="true"><use href="#m-phone"></use></svg>`;
    article.append(copy, call);
    return article;
  }

  function renderAlphabetIndex() {
    dom.mobileAlphabetIndex.innerHTML = "";
    LETTERS.forEach(letter => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = letter;
      button.dataset.letter = letter;
      button.setAttribute("aria-label", `跳转到${letter}组`);
      button.addEventListener("click", () => jumpToLetter(letter));
      dom.mobileAlphabetIndex.appendChild(button);
    });
    updateAlphabetIndex();
  }

  function updateAlphabetIndex() {
    dom.mobileAlphabetIndex.querySelectorAll("button").forEach(button => {
      const letter = button.dataset.letter;
      button.disabled = !state.availableLetters.has(letter);
      button.classList.toggle("active", letter === state.activeLetter && !button.disabled);
    });
  }

  function jumpToLetter(letter) {
    const target = document.getElementById(`mobile-group-${letter === "#" ? "hash" : letter}`);
    if (!target) return;
    state.activeLetter = letter;
    updateAlphabetIndex();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDocumentScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      let current = "";
      dom.mobileContactList.querySelectorAll(".mobile-group").forEach(section => {
        if (section.getBoundingClientRect().top <= 88) current = section.dataset.letter;
      });
      if (current && current !== state.activeLetter) {
        state.activeLetter = current;
        updateAlphabetIndex();
      }
    });
  }

  function openOrganizationSheet() {
    state.draftOrgId = state.selectedOrgId;
    expandAncestors(state.draftOrgId);
    renderOrganizationTree();
    dom.mobileOrgOverlay.hidden = false;
    dom.mobileOrgTrigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("mobile-sheet-open");
    dom.mobileSheetClose.focus();
  }

  function closeOrganizationSheet() {
    if (dom.mobileOrgOverlay.hidden) return;
    dom.mobileOrgOverlay.hidden = true;
    dom.mobileOrgTrigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mobile-sheet-open");
    dom.mobileOrgTrigger.focus();
  }

  function confirmOrganization() {
    state.selectedOrgId = state.draftOrgId;
    const selected = state.selectedOrgId === "all" ? null : findOrganization(state.selectedOrgId);
    dom.mobileOrgText.textContent = `组织架构（${selected ? selected.name : "全部"}）`;
    closeOrganizationSheet();
    applyFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderOrganizationTree() {
    dom.mobileOrgTree.innerHTML = "";
    const allRoot = state.organizations.find(node => node.id === "all");
    const roots = allRoot ? (allRoot.children || []) : state.organizations;
    if (roots.length) renderOrganizationNodes(roots, dom.mobileOrgTree, 0);
  }

  function renderOrganizationNodes(nodes, container, depth) {
    nodes.forEach(node => {
      const hasChildren = Boolean(node.children && node.children.length);
      const row = document.createElement("div");
      row.className = `mobile-tree-row ${state.draftOrgId === node.id ? "selected" : ""}`;
      row.style.paddingLeft = `${Math.max(0, depth) * 22 + 2}px`;
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-selected", String(state.draftOrgId === node.id));
      if (hasChildren) row.setAttribute("aria-expanded", String(state.expandedOrgIds.has(node.id)));

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = `mobile-tree-toggle ${state.expandedOrgIds.has(node.id) ? "expanded" : ""} ${hasChildren ? "" : "leaf"}`;
      toggle.setAttribute("aria-label", hasChildren ? `${state.expandedOrgIds.has(node.id) ? "收起" : "展开"}${node.name}` : "");
      toggle.innerHTML = `<svg><use href="#m-chevron-down"></use></svg>`;
      toggle.addEventListener("click", event => {
        event.stopPropagation();
        if (!hasChildren) return;
        state.expandedOrgIds.has(node.id) ? state.expandedOrgIds.delete(node.id) : state.expandedOrgIds.add(node.id);
        renderOrganizationTree();
      });

      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", `mobile-tree-icon ${node.id === "company" ? "company" : ""}`);
      icon.innerHTML = `<use href="#${node.id === "company" ? "m-building" : "m-folder"}"></use>`;
      const name = document.createElement("span");
      name.className = "mobile-tree-name";
      name.textContent = node.name;
      row.append(toggle, icon, name);
      if (state.draftOrgId === node.id) {
        const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        check.setAttribute("class", "mobile-tree-check");
        check.innerHTML = `<use href="#m-check"></use>`;
        row.appendChild(check);
      }
      row.addEventListener("click", () => {
        state.draftOrgId = node.id;
        renderOrganizationTree();
      });
      container.appendChild(row);
      if (hasChildren && state.expandedOrgIds.has(node.id)) renderOrganizationNodes(node.children, container, depth + 1);
    });
  }

  function findOrganization(id, node = state.organizations[0], ancestors = []) {
    if (!node) return null;
    if (node.id === id) return { ...node, ancestors };
    for (const child of node.children || []) {
      const found = findOrganization(id, child, [...ancestors, node.id]);
      if (found) return found;
    }
    return null;
  }

  function collectOrganizationIds(node, result = []) {
    if (!node) return result;
    result.push(node.id);
    (node.children || []).forEach(child => collectOrganizationIds(child, result));
    return result;
  }

  function expandAncestors(id) {
    const node = findOrganization(id);
    if (node) node.ancestors.forEach(parentId => state.expandedOrgIds.add(parentId));
  }

  function setLoading(loading) {
    dom.mobileLoading.hidden = !loading;
    dom.mobileContactList.hidden = loading;
    dom.mobileResultCount.hidden = loading;
    if (loading) dom.mobileEmpty.hidden = true;
  }
})();
