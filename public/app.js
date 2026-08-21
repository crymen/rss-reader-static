(() => {
  const STORAGE_KEY = "mixed-rss-reader.sources.v1";
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const updateDayOf = item => Number.isInteger(item?.update_day) && item.update_day >= 0 && item.update_day <= 6 ? item.update_day : 0;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = $("[data-rss-reader]");
  const toast = (message, error = false) => {
    const node = document.createElement("div");
    node.className = `toast${error ? " error" : ""}`;
    node.textContent = message;
    $("[data-toasts]").append(node);
    setTimeout(() => node.remove(), 3200);
  };
  const copyText = async (value) => {
    try { await navigator.clipboard.writeText(value); }
    catch {
      const area = document.createElement("textarea"); area.value = value;
      document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
    }
  };
  const safeSources = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item && item.id && item.title && item.rss_url) : [];
    } catch { return []; }
  };
  let sources = safeSources(), editingId = null, items = [], feedFormat = "";
  const select = $("[data-source-select]", root), sourceList = $("[data-source-list]", root);
  const titleInput = $("[data-source-title]", root), urlInput = $("[data-source-url]", root);
  const updateDayInput = $("[data-source-update-day]", root), updateDayFilter = $("[data-update-day-filter]", root);
  const list = $("[data-reader-list]", root), results = $("[data-results]", root);
  const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  const resetForm = () => {
    editingId = null; titleInput.value = ""; urlInput.value = ""; updateDayInput.value = "0";
    $("[data-source-save]", root).textContent = "添加地址";
    $("[data-source-cancel]", root).classList.add("is-hidden");
  };
  const editSource = item => {
    editingId = item.id; titleInput.value = item.title; urlInput.value = item.rss_url; updateDayInput.value = String(updateDayOf(item));
    $("[data-source-save]", root).textContent = "保存修改";
    $("[data-source-cancel]", root).classList.remove("is-hidden"); titleInput.focus();
  };
  const renderSources = selectedId => {
    select.replaceChildren(new Option("请选择 RSS 地址", "")); sourceList.replaceChildren();
    const filterValue = updateDayFilter.value;
    const visibleSources = sources.filter(item => filterValue === "" || updateDayOf(item) === Number(filterValue));
    visibleSources.forEach(item => {
      select.add(new Option(item.title, item.id));
      const row = document.createElement("div"); row.className = "source-item";
      const info = document.createElement("div"); info.className = "source-info";
      const titleRow = document.createElement("div"); titleRow.className = "source-title-row";
      const title = document.createElement("strong"); title.textContent = item.title;
      const weekday = document.createElement("span"); weekday.className = "weekday-badge"; weekday.textContent = WEEKDAYS[updateDayOf(item)];
      titleRow.append(title, weekday);
      const url = document.createElement("span"); url.textContent = item.rss_url; info.append(titleRow, url);
      const actions = document.createElement("div"); actions.className = "source-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "button button-ghost"; edit.textContent = "编辑"; edit.onclick = () => editSource(item);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "button button-ghost danger"; remove.textContent = "删除";
      remove.onclick = () => { if (!confirm(`确定删除“${item.title}”吗？`)) return; sources = sources.filter(value => value.id !== item.id); persist(); if (editingId === item.id) resetForm(); renderSources(); toast("RSS 地址已删除"); };
      actions.append(edit, remove); row.append(info, actions); sourceList.append(row);
    });
    if (!visibleSources.length) {
      const empty = document.createElement("div"); empty.className = "empty source-empty"; empty.textContent = "该更新日暂无 RSS 地址。"; sourceList.append(empty);
    }
    if (selectedId && visibleSources.some(item => item.id === selectedId)) select.value = selectedId;
  };
  const firstText = (node, selectors) => {
    for (const selector of selectors) { const value = node.querySelector(selector)?.textContent?.trim(); if (value) return value; }
    return "";
  };
  const linkValue = (node, rel) => {
    const links = [...node.querySelectorAll("link")];
    const match = links.find(link => !rel || (link.getAttribute("rel") || "alternate") === rel);
    return match?.getAttribute("href") || match?.textContent?.trim() || "";
  };
  const downloadLink = node => {
    const enclosure = [...node.querySelectorAll("enclosure")].find(value => value.getAttribute("url"));
    if (enclosure) return enclosure.getAttribute("url");
    const atom = [...node.querySelectorAll("link")].find(value => value.getAttribute("rel") === "enclosure");
    if (atom?.getAttribute("href")) return atom.getAttribute("href");
    const candidates = [firstText(node, ["magnetURI", "magnet", "torrent"]), linkValue(node, "enclosure"), linkValue(node, "alternate")];
    return candidates.find(value => /^magnet:|\.torrent(?:$|\?)/i.test(value)) || "";
  };
  const parseFeed = xml => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("RSS XML 解析失败");
    const isAtom = !!doc.querySelector("feed");
    const nodes = [...doc.querySelectorAll(isAtom ? "entry" : "item")];
    const title = firstText(doc, isAtom ? ["feed > title"] : ["channel > title", "rss > title"]);
    const parsed = nodes.map(node => {
      const torrentUrl = downloadLink(node);
      return {
        title: firstText(node, ["title"]) || "未命名资源",
        description: firstText(node, ["description", "summary", "content"]),
        detailUrl: linkValue(node, "alternate") || firstText(node, ["link", "guid"]),
        torrentUrl,
        publishedAt: firstText(node, ["pubDate", "published", "updated", "date"]),
        type: torrentUrl.startsWith("magnet:") ? "Magnet" : torrentUrl ? "Torrent" : ""
      };
    });
    return { title, items: parsed, format: isAtom ? "Atom" : "RSS" };
  };
  const updateSelection = () => {
    const count = $$("[data-select]:checked", list).length;
    $("[data-copy-selected]", root).textContent = count ? `复制已选链接（${count}）` : "复制已选链接";
    $("[data-clear-selected]", root).disabled = count === 0;
  };
  const renderItems = query => {
    list.replaceChildren(); const folded = (query || "").trim().toLocaleLowerCase();
    const visible = items.filter(item => !folded || `${item.title}\n${item.description}`.toLocaleLowerCase().includes(folded));
    visible.forEach(item => {
      const card = document.createElement("article"); card.className = "reader-item";
      const check = document.createElement("input"); check.type = "checkbox"; check.dataset.select = ""; check.value = item.torrentUrl; check.disabled = !item.torrentUrl; check.setAttribute("aria-label", `选择 ${item.title}`); check.onchange = updateSelection;
      const body = document.createElement("div"); const title = document.createElement("h3"); title.textContent = item.title;
      const tags = document.createElement("div"); tags.className = "tags"; if (item.type) { const tag = document.createElement("span"); tag.textContent = item.type; tags.append(tag); }
      const description = document.createElement("p"); description.className = "description"; description.textContent = item.description;
      const meta = document.createElement("div"); meta.className = "meta";
      if (item.publishedAt) { const date = new Date(item.publishedAt); const time = document.createElement("time"); time.textContent = Number.isNaN(date.valueOf()) ? item.publishedAt : new Intl.DateTimeFormat("zh-CN", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Shanghai"}).format(date); meta.append(time); }
      body.append(title, tags, description, meta);
      const actions = document.createElement("div"); actions.className = "item-actions";
      if (/^https?:\/\//i.test(item.detailUrl)) { const detail = document.createElement("a"); detail.className = "button button-ghost"; detail.href = item.detailUrl; detail.target = "_blank"; detail.rel = "noopener noreferrer"; detail.textContent = "详情页"; actions.append(detail); }
      if (item.torrentUrl) { const copy = document.createElement("button"); copy.type = "button"; copy.className = "button button-secondary"; copy.textContent = "复制链接"; copy.onclick = async () => { await copyText(item.torrentUrl); toast("下载链接已复制"); }; actions.append(copy); }
      card.append(check, body, actions); list.append(card);
    });
    $("[data-empty]", root).classList.toggle("is-hidden", visible.length > 0);
    $("[data-count]", root).textContent = `${feedFormat} · ${visible.length} / ${items.length} 条`;
    updateSelection();
  };
  $("[data-source-form]", root).onsubmit = event => {
    event.preventDefault(); const title = titleInput.value.trim(), rss_url = urlInput.value.trim(), update_day = Number(updateDayInput.value);
    let parsed; try { parsed = new URL(rss_url); } catch { toast("请输入有效的 RSS 地址", true); return; }
    if (parsed.protocol !== "https:") { toast("RSS 地址必须使用 HTTPS", true); return; }
    const wasEditing = Boolean(editingId);
    if (editingId) sources = sources.map(item => item.id === editingId ? {...item, title, rss_url, update_day} : item);
    else sources.push({id: crypto.randomUUID(), title, rss_url, update_day});
    const selectedId = editingId || sources.at(-1).id; persist(); resetForm(); renderSources(selectedId); toast(wasEditing ? "RSS 地址已更新" : "RSS 地址已添加");
  };
  $("[data-source-cancel]", root).onclick = resetForm;
  updateDayFilter.onchange = () => renderSources(select.value);
  $("[data-load]", root).onclick = async event => {
    const selected = sources.find(item => item.id === select.value); if (!selected) { toast("请先选择 RSS 地址", true); return; }
    const button = event.currentTarget; button.disabled = true; button.textContent = "读取中…";
    try {
      const response = await fetch(`/api/rss?url=${encodeURIComponent(selected.rss_url)}`);
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "RSS 读取失败");
      const data = parseFeed(payload.xml || ""); items = data.items; feedFormat = data.format;
      $("[data-feed-title]", root).textContent = `${selected.title} · ${data.title || "RSS 内容"}`; results.classList.remove("is-hidden"); renderItems($("[data-search]", root).value);
    } catch (error) { toast(error.message || "RSS 读取失败", true); }
    finally { button.disabled = false; button.textContent = "读取 RSS"; }
  };
  $("[data-search]", root).oninput = event => renderItems(event.target.value);
  $("[data-copy-selected]", root).onclick = async () => { const links = $$("[data-select]:checked", list).map(node => node.value).filter(Boolean); if (!links.length) return toast("请先选择需要下载的资源", true); await copyText(links.join("\n")); toast(`已复制 ${links.length} 个下载链接`); };
  $("[data-clear-selected]", root).onclick = () => { $$("[data-select]:checked", list).forEach(node => { node.checked = false; }); updateSelection(); };
  renderSources();
})();
