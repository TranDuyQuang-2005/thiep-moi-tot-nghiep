"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Invite = { code: string; key: string; recipient: string };
type Reply = { name: string; attendance: "yes" | "no" | "maybe"; message: string; submittedAt: string };
type Entry = { invite: Invite; reply: Reply | null };
type Body = { x: number; y: number; vx: number; vy: number; w: number; h: number };

const STORAGE_KEY = "vaa-managed-invitations";
const attendanceText = { yes: "Sẽ tham dự", maybe: "Chưa chắc tham dự", no: "Không thể tham dự" };

function savedInvites(): Invite[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Invite => !!item && typeof item === "object" &&
      /^[a-f0-9]{16}$/.test(item.code) && /^[a-f0-9]{64}$/.test(item.key) && typeof item.recipient === "string");
  } catch { return []; }
}

function FloatingStage({ entries, selected, setSelected, playing }: {
  entries: Entry[]; selected: string | null; setSelected: (code: string | null) => void; playing: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const bodiesRef = useRef(new Map<string, Body>());
  const pauseRef = useRef(false);
  useEffect(() => { pauseRef.current = !playing || !!selected; }, [playing, selected]);
  const identity = entries.map(entry => entry.invite.code).join("|");

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();
    const bodies = bodiesRef.current;
    for (const [code] of bodies) if (!entries.some(entry => entry.invite.code === code)) bodies.delete(code);

    const position = () => {
      const width = stage.clientWidth, height = stage.clientHeight;
      entries.forEach((entry, index) => {
        const code = entry.invite.code;
        const node = nodesRef.current.get(code);
        if (!node) return;
        const w = node.offsetWidth, h = node.offsetHeight;
        let body = bodies.get(code);
        if (!body) {
          const cols = Math.max(1, Math.floor(width / (w + 30)));
          const col = index % cols, row = Math.floor(index / cols);
          body = { x: 20 + col * Math.max(w + 10, (width - w - 40) / cols),
            y: 55 + row * (h + 20), vx: (index % 2 ? -1 : 1) * (0.38 + (index % 4) * .11),
            vy: (index % 3 ? 1 : -1) * (0.31 + (index % 5) * .08), w, h };
          bodies.set(code, body);
        }
        body.w = w; body.h = h;
        body.x = Math.max(0, Math.min(body.x, Math.max(0, width - w)));
        body.y = Math.max(0, Math.min(body.y, Math.max(0, height - h)));
        node.style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
      });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(stage);

    const tick = (now: number) => {
      const step = Math.min(2, Math.max(.4, (now - last) / 16.67));
      last = now;
      if (!pauseRef.current && !reduced) {
        const width = stage.clientWidth, height = stage.clientHeight;
        const active = entries.map(entry => [entry.invite.code, bodies.get(entry.invite.code)] as const)
          .filter((pair): pair is readonly [string, Body] => !!pair[1]);
        for (const [, body] of active) {
          body.x += body.vx * step; body.y += body.vy * step;
          if (body.x <= 0 || body.x + body.w >= width) {
            body.x = Math.max(0, Math.min(body.x, width - body.w)); body.vx *= -1;
          }
          if (body.y <= 0 || body.y + body.h >= height) {
            body.y = Math.max(0, Math.min(body.y, height - body.h)); body.vy *= -1;
          }
        }
        for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
          const [firstCode, a] = active[i], [secondCode, b] = active[j];
          const dx = a.x + a.w / 2 - b.x - b.w / 2;
          const dy = a.y + a.h / 2 - b.y - b.h / 2;
          const overlapX = (a.w + b.w) / 2 - Math.abs(dx);
          const overlapY = (a.h + b.h) / 2 - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          if (overlapX < overlapY) {
            const push = Math.sign(dx || 1) * (overlapX / 2 + .5);
            a.x += push; b.x -= push;
            const speedA = a.vx, speedB = b.vx;
            a.vx = speedB || -speedA; b.vx = speedA || -speedB;
          } else {
            const push = Math.sign(dy || 1) * (overlapY / 2 + .5);
            a.y += push; b.y -= push;
            const speedA = a.vy, speedB = b.vy;
            a.vy = speedB || -speedA; b.vy = speedA || -speedB;
          }
          for (const code of [firstCode, secondCode]) {
            const node = nodesRef.current.get(code);
            if (node && !node.classList.contains("wish-impact")) {
              node.classList.add("wish-impact");
              window.setTimeout(() => node.classList.remove("wish-impact"), 500);
            }
          }
        }
        for (const [code, body] of active) {
          const node = nodesRef.current.get(code);
          if (node) node.style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [identity, entries]);

  return <div className="wishes-stage" ref={stageRef} aria-label="Vùng trình diễn lời chúc">
    <div className="wishes-orbit orbit-one" aria-hidden="true" /><div className="wishes-orbit orbit-two" aria-hidden="true" />
    <div className="wishes-stars" aria-hidden="true">✦ &nbsp; ✧ &nbsp; ✦ &nbsp; ✧ &nbsp; ✦</div>
    {!entries.length && <div className="wishes-empty"><span>✧</span><p>Chưa có lời chúc nào để trình diễn.</p><small>Khi khách gửi phản hồi, thẻ lời chúc sẽ xuất hiện ở đây.</small></div>}
    {entries.map((entry, index) => <button key={entry.invite.code} type="button"
      className={`floating-wish wish-tone-${index % 4}${selected === entry.invite.code ? " wish-picked" : ""}`}
      ref={node => { if (node) nodesRef.current.set(entry.invite.code, node); else nodesRef.current.delete(entry.invite.code); }}
      onClick={() => setSelected(entry.invite.code)} aria-label={`Xem chi tiết lời chúc của ${entry.reply?.name || entry.invite.recipient}`}>
      <span className="floating-wish-symbol" aria-hidden="true">✦</span>
      <strong>{entry.reply?.name || entry.invite.recipient}</strong>
      <small className={`attendance-pill attendance-${entry.reply?.attendance}`}>{entry.reply ? attendanceText[entry.reply.attendance] : "Chưa phản hồi"}</small>
      <span className="floating-wish-preview">{entry.reply?.message || "Một lời chúc đang chờ được viết…"}</span>
      <span className="floating-wish-more">Chạm để đọc trọn vẹn ↗</span>
    </button>)}
  </div>;
}

export default function ResponsesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [clean, setClean] = useState(false);
  const [offset, setOffset] = useState(0);
  const [capacity, setCapacity] = useState(8);
  const [copied, setCopied] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (items: Invite[]) => {
    setLoading(true);
    const result = await Promise.all(items.map(async invite => {
      try {
        const response = await fetch(`/api/invitations/${invite.code}/responses`,
          { headers: { Authorization: `Bearer ${invite.key}` }, cache: "no-store" });
        if (!response.ok) return null;
        const data = await response.json() as { responses?: Reply[] };
        return { invite, reply: data.responses?.[0] || null };
      } catch { return null; }
    }));
    setEntries(result.filter((entry): entry is Entry => entry !== null));
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("manage"), key = params.get("key");
    const current = savedInvites();
    if (!code && !key) { setInvites(current); void load(current); return; }
    if (!code || !key || !/^[a-f0-9]{16}$/.test(code) || !/^[a-f0-9]{64}$/.test(key)) {
      setError("Link quản lý không hợp lệ."); setInvites(current); void load(current); return;
    }
    void (async () => {
      try {
        const [privateResponse, publicResponse] = await Promise.all([
          fetch(`/api/invitations/${code}/responses`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" }),
          fetch(`/api/invitations/${code}`, { cache: "no-store" }),
        ]);
        if (!privateResponse.ok || !publicResponse.ok) throw new Error("Link quản lý không hợp lệ.");
        const invitation = await publicResponse.json() as { recipient?: string };
        const imported = { code, key, recipient: invitation.recipient || "Khách mời" };
        const next = [imported, ...current.filter(item => item.code !== code)];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.history.replaceState(null, "", "/responses");
        setInvites(next); setSelected(code); void load(next);
      } catch { setError("Link quản lý không hợp lệ hoặc chưa tải được phản hồi."); setInvites(current); void load(current); }
    })();
  }, [load]);

  useEffect(() => {
    const resize = () => setCapacity(window.innerWidth <= 600 ? 3 : window.innerWidth <= 950 ? 6 : 8);
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!playing || selected || drawer || entries.filter(entry => entry.reply).length <= capacity) return;
    const interval = window.setInterval(() => setOffset(value => value + 1), 8500);
    return () => window.clearInterval(interval);
  }, [playing, selected, drawer, entries, capacity]);
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelected(null); setDrawer(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const replied = useMemo(() => entries.filter(entry => !!entry.reply), [entries]);
  const shown = useMemo(() => {
    const batch = replied.length <= capacity ? [...replied] : Array.from({ length: capacity }, (_, index) => replied[(offset + index) % replied.length]);
    const picked = entries.find(entry => entry.invite.code === selected);
    if (picked && !batch.some(entry => entry.invite.code === selected)) {
      if (batch.length < capacity) batch.push(picked); else batch[batch.length - 1] = picked;
    }
    return batch;
  }, [replied, entries, capacity, offset, selected]);
  const chosen = entries.find(entry => entry.invite.code === selected) || null;

  const openEntry = (code: string) => { setSelected(code); setDrawer(false); };
  const copyLink = async (invite: Invite) => {
    const url = new URL(`/responses?manage=${invite.code}&key=${invite.key}`, window.location.origin).toString();
    try { await navigator.clipboard.writeText(url); setCopied(invite.code); window.setTimeout(() => setCopied(""), 2400); }
    catch { window.prompt("Sao chép link quản lý riêng", url); }
  };

  return <main className={`wishes-page${clean ? " wishes-clean" : ""}`} ref={shellRef}>
    <div className="wishes-grain" aria-hidden="true" />
    <header className="wishes-header">
      <div className="wishes-brand"><span className="wishes-mark">✦</span><div><small>GÓC KỶ NIỆM TỐT NGHIỆP</small><h1>Những lời chúc dành cho bạn<span>.</span></h1></div></div>
      <div className="wishes-toolbar">
        <button type="button" onClick={() => setDrawer(value => !value)} aria-expanded={drawer} aria-controls="wish-list">☷ &nbsp; Danh sách <span>{replied.length}</span></button>
        <button type="button" onClick={() => setPlaying(value => !value)}>{playing ? "Ⅱ Tạm dừng" : "▶ Tiếp tục"}</button>
        <button type="button" onClick={() => { setClean(value => !value); setDrawer(false); setSelected(null); }}>{clean ? "Hiện công cụ" : "Ẩn công cụ"}</button>
        <button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void shellRef.current?.requestFullscreen(); }}>{fullscreen ? "Thu nhỏ" : "⛶ Toàn màn hình"}</button>
      </div>
    </header>
    <div className="wishes-intro"><p>Chạm vào một lời chúc đang bay để đọc đầy đủ. Các tấm thiệp sẽ nảy nhẹ khi gặp nhau.</p><span>{replied.length} lời chúc đã gửi · {invites.length} thiệp đã tạo</span></div>
    {error && <p className="wishes-alert" role="alert">{error}</p>}
    <section className="wishes-frame" aria-label="Trình diễn phản hồi">
      {loading ? <div className="wishes-loading">Đang mở những lời chúc…</div> : <FloatingStage entries={shown} selected={selected} setSelected={setSelected} playing={playing} />}
      {chosen && <div className="wish-detail" role="dialog" aria-modal="false" aria-label={`Lời chúc của ${chosen.reply?.name || chosen.invite.recipient}`}>
        <button className="wish-detail-close" type="button" onClick={() => setSelected(null)} aria-label="Đóng chi tiết">×</button>
        <span className="wish-detail-kicker">MỘT LỜI CHÚC DÀNH CHO BẠN</span>
        <span className="wish-detail-flower" aria-hidden="true">✦</span>
        <h2>{chosen.reply?.name || chosen.invite.recipient}</h2>
        <span className={`attendance-pill attendance-${chosen.reply?.attendance}`}>{chosen.reply ? attendanceText[chosen.reply.attendance] : "Chưa có phản hồi"}</span>
        <p className="wish-detail-message">{chosen.reply?.message || "Người nhận thiệp chưa gửi lời chúc."}</p>
        <span className="wish-detail-footer">✧ &nbsp; CẢM ƠN VÌ ĐÃ ĐỒNG HÀNH &nbsp; ✧</span>
      </div>}
      <div className="stage-corner stage-corner-left" aria-hidden="true">✧ &nbsp; ✦ &nbsp; ✧</div>
      <div className="stage-corner stage-corner-right" aria-hidden="true">✧ &nbsp; ✦ &nbsp; ✧</div>
    </section>
    <footer className="wishes-footer"><span>✦ &nbsp; TỪNG LỜI NHẮN, MỘT KỶ NIỆM &nbsp; ✦</span><a href="/">← Quay lại trang tạo thiệp</a></footer>
    {clean && <button type="button" className="restore-tools" onClick={() => setClean(false)}>Hiện công cụ</button>}
    {drawer && !clean && <><button className="wish-drawer-scrim" type="button" onClick={() => setDrawer(false)} aria-label="Đóng danh sách" />
      <aside id="wish-list" className="wish-drawer" aria-label="Danh sách phản hồi">
        <div className="wish-drawer-top"><div><small>DANH SÁCH RIÊNG TƯ</small><h2>Phản hồi khách mời</h2></div><button type="button" onClick={() => setDrawer(false)} aria-label="Đóng danh sách">×</button></div>
        <p>Chọn một người để đưa thẻ vào vùng trình diễn và đọc lời chúc đầy đủ.</p>
        <button className="wish-refresh" type="button" disabled={loading} onClick={() => void load(invites)}>{loading ? "Đang tải…" : "↻ Làm mới phản hồi"}</button>
        <div className="wish-drawer-list">{entries.map(entry => <div className="wish-drawer-item" key={entry.invite.code}>
          <button type="button" onClick={() => openEntry(entry.invite.code)}><strong>{entry.reply?.name || entry.invite.recipient}</strong><small>{entry.reply ? attendanceText[entry.reply.attendance] : "Chưa có phản hồi"}</small><span>{entry.reply?.message || "Đang chờ lời chúc…"}</span></button>
          <button type="button" className="wish-copy" onClick={() => void copyLink(entry.invite)}>{copied === entry.invite.code ? "Đã sao chép ✓" : "Sao chép link quản lý riêng ↗"}</button>
        </div>)}{!entries.length && <p>Chưa có thiệp nào trên trình duyệt này. Hãy tạo thiệp hoặc mở link quản lý riêng để xem phản hồi.</p>}</div>
        <small className="wish-drawer-note">Chỉ người giữ link quản lý mới xem được phản hồi. Khi quay video đăng công khai, hãy chọn nội dung bạn muốn chia sẻ.</small>
      </aside></>}
  </main>;
}
