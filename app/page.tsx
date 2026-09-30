"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import GrayParticleField from "./GrayParticleField";

type Ceremony = { graduate: string; degree: string; date: string; time: string; venue: string; address: string; note: string; musicUrl: string };
type ManagedInvite = { code: string; recipient: string; key: string };
const initial: Ceremony = { graduate: "", degree: "Tân cử nhân", date: "", time: "", venue: "", address: "", note: "Sự hiện diện của bạn là niềm vui lớn đối với mình trong ngày đặc biệt này.", musicUrl: "" };
const pad = (n: number) => String(n).padStart(2, "0");
const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function readInvitation(text: string): { recipient: string; ceremony: Ceremony } | null {
  try {
    if (text.length > 12000) return null;
    const data = JSON.parse(text) as { recipient?: unknown; ceremony?: Record<string, unknown> };
    if (typeof data.recipient !== "string" || !data.recipient.trim() || data.recipient.length > 60 || !data.ceremony) return null;
    const limits: Record<keyof Ceremony, number> = { graduate: 60, degree: 45, date: 10, time: 5, venue: 80, address: 100, note: 220, musicUrl: 500 };
    for (const [key, max] of Object.entries(limits)) if (key !== "musicUrl" && (typeof data.ceremony[key] !== "string" || (data.ceremony[key] as string).length > max)) return null;
    const ceremony = Object.fromEntries(Object.entries(limits).map(([key]) => [key, key === "musicUrl" && data.ceremony![key] === undefined ? "" : (data.ceremony![key] as string).normalize("NFC")])) as Ceremony;
    if (typeof ceremony.musicUrl !== "string" || ceremony.musicUrl.length > 500) return null;
    if (!ceremony.graduate.trim() || !ceremony.date || !ceremony.time || !ceremony.venue.trim() || !ceremony.address.trim()) return null;
    return { recipient: data.recipient.trim().normalize("NFC"), ceremony };
  } catch { return null; }
}
function calendarDays(date: string): (number | null)[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const [year, month] = date.split("-").map(Number);
  if (month < 1 || month > 12) return [];
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  return [...Array(offset).fill(null), ...Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1)];
}

export default function Home() {
  const [ceremony, setCeremony] = useState<Ceremony>(initial);
  const [recipient, setRecipient] = useState("");
  const [code, setCode] = useState("");
  const [guest, setGuest] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [replyName, setReplyName] = useState("");
  const [attendance, setAttendance] = useState<"yes" | "no" | "maybe">("yes");
  const [message, setMessage] = useState("");
  const [managed, setManaged] = useState<ManagedInvite[]>([]);
  const [replyNotice, setReplyNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("manage")) {
      window.location.replace(`/responses${window.location.search}`);
      return;
    }
    const id = window.location.pathname.match(/^\/i\/([a-f0-9]{16})\/?$/)?.[1];
    if (id) {
      fetch(`/api/invitations/${id}`).then(async r => { if (!r.ok) throw new Error("Không tìm thấy thiệp mời này."); return r.text(); })
        .then(text => { const data = readInvitation(text); if (!data) throw new Error("Thiệp mời không hợp lệ."); setCeremony(data.ceremony); setRecipient(data.recipient); setReplyName(data.recipient); setCode(id); setGuest(true); setCelebrate(true); })
        .catch(e => setError(e instanceof Error ? e.message : "Không mở được thiệp mời.")).finally(() => setLoaded(true));
      return;
    }
    const legacy = new URLSearchParams(window.location.search).get("invite");
    if (legacy !== null) {
      const data = readInvitation(legacy);
      if (data) { setCeremony(data.ceremony); setRecipient(data.recipient); setReplyName(data.recipient); setGuest(true); setCelebrate(true); }
      else setError("Thiệp mời không hợp lệ.");
    } else try {
      const saved = localStorage.getItem("vaa-graduation-ceremony"); if (saved) setCeremony({ ...initial, ...JSON.parse(saved) });
      const savedInvites = localStorage.getItem("vaa-managed-invitations"); if (savedInvites) setManaged(JSON.parse(savedInvites));
    } catch { /* optional */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded && !guest && !error) try { localStorage.setItem("vaa-graduation-ceremony", JSON.stringify(ceremony)); } catch { /* optional */ } }, [ceremony, loaded, guest, error]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!guest || !ceremony.musicUrl) return;
    const audio = document.getElementById("invitation-audio") as HTMLAudioElement | null;
    if (!audio) return;
    audio.play().catch(() => {
      const retry = () => { void audio.play().then(() => { window.removeEventListener("pointerdown", retry); window.removeEventListener("keydown", retry); }).catch(() => {}); };
      window.addEventListener("pointerdown", retry); window.addEventListener("keydown", retry);
      audio.addEventListener("emptied", () => { window.removeEventListener("pointerdown", retry); window.removeEventListener("keydown", retry); }, { once: true });
    });
    return () => audio.pause();
  }, [guest, ceremony.musicUrl]);
  useEffect(() => { if (!celebrate) return; const timeout = window.setTimeout(() => setCelebrate(false), 6200); return () => window.clearTimeout(timeout); }, [celebrate]);

  const update = (field: keyof Ceremony, value: string) => { setCeremony(c => ({ ...c, [field]: value.normalize("NFC") })); setShareUrl(""); setNotice(""); };
  const updateRecipient = (value: string) => { setRecipient(value.normalize("NFC")); setShareUrl(""); setNotice(""); };
  const [year, month, day] = ceremony.date.split("-").map(Number);
  const target = ceremony.date && ceremony.time ? new Date(`${ceremony.date}T${ceremony.time}:00+07:00`).getTime() : NaN;
  const remaining = Number.isFinite(target) ? Math.max(0, Math.floor((target - now) / 1000)) : 0;
  const countdown = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
  const mapQuery = [ceremony.venue, ceremony.address].filter(Boolean).join(", ");
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  async function uploadMusic(file?: File) {
    if (!file) return;
    if (!/\.(mp3|ogg|m4a|wav)$/i.test(file.name) || !["audio/mpeg", "audio/mp3", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/wave"].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setNotice("Chọn tệp MP3, OGG, M4A hoặc WAV tối đa 12 MB."); return;
    }
    setUploadingMusic(true); setNotice("Đang tải nhạc lên...");
    try {
      const extension = file.name.split(".").pop()!.toLowerCase();
      const blob = await upload(`music/${crypto.randomUUID()}.${extension}`, file, { access: "private", handleUploadUrl: "/api/music/upload" });
      update("musicUrl", blob.url);
      setNotice("Đã tải nhạc lên. Nhạc sẽ phát khi khách mở thiệp nếu trình duyệt cho phép.");
    } catch { setNotice("Chưa tải được nhạc. Vui lòng thử lại."); }
    finally { setUploadingMusic(false); }
  }

  async function shareInvitation() {
    if (uploadingMusic) { setNotice("Đợi tải nhạc xong rồi hãy gửi thiệp."); return; }
    if (ceremony.musicUrl.trim()) {
      try { const audio = new URL(ceremony.musicUrl); if (audio.protocol !== "https:" || !/\.(mp3|ogg|m4a|wav)(?:[?#]|$)/i.test(audio.href)) throw Error(); }
      catch { setNotice("Nhạc nền cần link HTTPS trực tiếp tới tệp MP3, OGG, M4A hoặc WAV công khai; link YouTube không phát ẩn được."); return; }
    }
    if (!recipient.trim() || !ceremony.graduate.trim() || !ceremony.date || !ceremony.time || !ceremony.venue.trim() || !ceremony.address.trim()) {
      setNotice("Điền tên khách mời và đầy đủ thông tin buổi lễ trước khi gửi."); return;
    }
    setSharing(true); setNotice("Đang tạo link riêng...");
    try {
      const ownerKey = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(byte => byte.toString(16).padStart(2, "0")).join("");
      const r = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: recipient.trim(), ceremony, ownerKey }) });
      const data = await r.json() as { id?: string; error?: string };
      if (!r.ok || !data.id) throw new Error(data.error || "Chưa tạo được thiệp.");
      const url = new URL(`/i/${data.id}`, window.location.origin).toString();
      const next = [{ code: data.id, recipient: recipient.trim(), key: ownerKey }, ...managed];
      localStorage.setItem("vaa-managed-invitations", JSON.stringify(next)); setManaged(next);
      setShareUrl(url); setNotice("");
      if (navigator.share) {
        try { await navigator.share({ title: `Thiệp mời tốt nghiệp gửi ${recipient.trim()}`, text: `${recipient.trim()} ơi, mời bạn tham dự lễ tốt nghiệp của mình!`, url }); return; }
        catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); setNotice("Đã sao chép link. Bạn có thể dán vào Zalo hoặc Messenger."); }
      catch { setNotice("Sao chép link bên dưới để gửi cho khách mời."); }
    } catch (e) { setNotice(e instanceof Error ? e.message : "Chưa tạo được thiệp."); }
    finally { setSharing(false); }
  }
  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code) return;
    setSending(true); setReplyNotice("Đang gửi phản hồi...");
    try {
      const r = await fetch(`/api/invitations/${code}/responses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: replyName.trim(), attendance, message: message.trim() }) });
      const data = await r.json() as { response?: unknown; error?: string };
      if (!r.ok || !data.response) throw new Error(data.error || "Chưa gửi được lời chúc.");
      setReplyNotice("Đã lưu lời chúc và xác nhận tham dự của bạn. Cảm ơn bạn!");
    } catch (e) { setReplyNotice(e instanceof Error ? e.message : "Chưa gửi được phản hồi."); }
    finally { setSending(false); }
  }

  if (!loaded) return <main className="loading" aria-label="Đang mở thiệp mời" />;
  if (error) return <main className="loading"><h1>Không mở được thiệp mời</h1><p>{error}</p></main>;
  return <main className="invitation-app">
    {!guest && <section className="creator" aria-labelledby="creator-title">
      <div className="creator-heading"><img src="/vaa-logo.png" alt="Logo Học viện Hàng không Việt Nam" /><div><span>HỌC VIỆN HÀNG KHÔNG VIỆT NAM</span><h1 id="creator-title">Tạo thiệp mời tốt nghiệp</h1><p>Điền thông tin, xem thiệp bên dưới và gửi link riêng cho từng khách mời.</p></div></div>
      <div className="creator-grid">
        <label>Tên khách mời<input value={recipient} onChange={e => updateRecipient(e.target.value)} maxLength={60} placeholder="Ví dụ: Nguyễn Văn A" /></label>
        <label>Tên người tốt nghiệp<input value={ceremony.graduate} onChange={e => update("graduate", e.target.value)} maxLength={60} placeholder="Tên của bạn" /></label>
        <label>Danh xưng<input value={ceremony.degree} onChange={e => update("degree", e.target.value)} maxLength={45} /></label>
        <label>Ngày tổ chức<input type="date" value={ceremony.date} onChange={e => update("date", e.target.value)} /></label>
        <label>Giờ bắt đầu<input type="time" value={ceremony.time} onChange={e => update("time", e.target.value)} /></label>
        <label>Địa điểm<input value={ceremony.venue} onChange={e => update("venue", e.target.value)} maxLength={80} placeholder="Tên hội trường" /></label>
        <label>Địa chỉ<input value={ceremony.address} onChange={e => update("address", e.target.value)} maxLength={100} placeholder="Địa chỉ cụ thể" /></label>
        <label className="wide">Lời nhắn<textarea value={ceremony.note} onChange={e => update("note", e.target.value)} maxLength={220} rows={2} /></label>
        <label className="wide">Nhạc nền (tùy chọn)<input type="file" accept=".mp3,.ogg,.m4a,.wav,audio/mpeg,audio/ogg,audio/mp4,audio/wav" disabled={uploadingMusic} onChange={e => void uploadMusic(e.target.files?.[0])} /><small>{uploadingMusic ? "Đang tải nhạc lên..." : ceremony.musicUrl ? "Đã chọn nhạc. Chọn tệp khác để thay đổi. Tối đa 12 MB." : "Tải tệp MP3, OGG, M4A hoặc WAV, tối đa 12 MB. Trình duyệt có thể yêu cầu khách chạm vào trang trước khi phát nhạc."}</small></label>
      </div>
      <button type="button" className="primary-action" disabled={sharing || uploadingMusic} onClick={shareInvitation}>{sharing ? "Đang tạo thiệp..." : `Gửi thiệp cho ${recipient.trim() || "khách mời"}`}</button>
      {notice && <p className="creator-notice" role="status">{notice}</p>}
      {shareUrl && <div className="share-result"><label htmlFor="share-link">Link thiệp riêng</label><input id="share-link" readOnly value={shareUrl} onFocus={e => e.target.select()} /><a href={shareUrl} target="_blank" rel="noopener noreferrer">Mở thử thiệp của người nhận ↗</a></div>}
      <section className="owner-inbox owner-inbox-compact"><div><h2>Phản hồi và lời chúc</h2><p>Xem các phản hồi riêng tư trên trang trình diễn chuyển động.</p></div><a className="primary-action response-launch" href="/responses" target="_blank" rel="noopener noreferrer">Xem phản hồi và lời chúc ↗</a></section>
    </section>}
    {guest && celebrate && <div className="confetti" aria-hidden="true">{Array.from({ length: 54 }, (_, i) => <i key={i} style={{ "--i": i, "--x": `${(i * 47 + 13) % 100}vw`, "--delay": `${(i * 13) % 17 * .09}s`, "--duration": `${3 + (i % 6) * .28}s` } as React.CSSProperties} />)}</div>}
    {guest && ceremony.musicUrl && <audio id="invitation-audio" src={ceremony.musicUrl.includes(".private.blob.vercel-storage.com/") && code ? `/api/music/${code}` : ceremony.musicUrl} loop preload="auto" />}
    <div className="paper-shell"><article className="invitation-paper" aria-label="Thiệp mời tốt nghiệp">
      <div className="pink-diffusion-field" aria-hidden="true"><i /><i /><i /><i /></div>
      <GrayParticleField />
      <section className="invitation-hero">
        <div className="floral-corner floral-left" aria-hidden="true">✿ · ✧ · ✿</div><div className="floral-corner floral-right" aria-hidden="true">✿ · ✧ · ✿</div>
        <p className="micro-title">HỌC VIỆN HÀNG KHÔNG VIỆT NAM</p>
        <div className="hero-logo"><img src="/vaa-logo.png" alt="Logo Học viện Hàng không Việt Nam" /></div>
        <p className="overline">THƯ MỜI THAM DỰ</p>
        <h2>Lễ tốt nghiệp của<br /><span className="graduate-name" style={{ "--name-length": Math.min(60, (ceremony.graduate.trim() || "Tên người tốt nghiệp").length) } as React.CSSProperties}>{ceremony.graduate.trim() || "Tên người tốt nghiệp"}</span></h2>
        <p className="honour">HÂN HẠNH MỜI</p><p className="recipient-name">{recipient.trim() || "Tên khách mời"}</p>
        <div className="dotted-rule" />
        <p className="hero-date">{ceremony.date ? `${pad(day)}/${pad(month)}/${year}` : "Ngày tổ chức"}<span> · </span>{ceremony.time ? `${ceremony.time} giờ` : "Giờ bắt đầu"}</p>
        <p className="hero-location">{ceremony.venue.trim() || "Địa điểm tổ chức"}<br />{ceremony.address.trim() || "Địa chỉ buổi lễ"}</p>
        <div className="graduation-symbol" aria-hidden="true"><span>✦</span><strong>🎓</strong><span>✦</span></div>
        <p className="degree-line">{ceremony.degree.trim() || "Tân cử nhân"}</p><p className="personal-note">{ceremony.note}</p>
        <div className="hero-scroll" aria-hidden="true">CUỘN ĐỂ XEM THÊM <span>↓</span></div>
      </section>
      <section className="calendar-section" aria-labelledby="calendar-title">
        <div className="month-ribbon" id="calendar-title"><span>THÁNG {month ? pad(month) : "--"}</span><span>{year || "----"}</span></div>
        <div className="calendar-grid" role="grid" aria-label="Lịch tháng diễn ra lễ tốt nghiệp">
          {weekdays.map(label => <div className="weekday" key={label} role="columnheader">{label}</div>)}
          {calendarDays(ceremony.date).map((value, index) => <div key={index} className={`calendar-day ${value === day ? "marked-day" : ""}`} role="gridcell" aria-label={value === day ? `Ngày tổ chức ${value}` : undefined}>{value || ""}</div>)}
        </div>
      </section>
      <section className="countdown-section" aria-labelledby="countdown-title"><h3 id="countdown-title">Cùng đếm ngược thời gian</h3>
        {Number.isFinite(target) ? <><div className="countdown-row">{countdown.map((value, index) => <div className="countdown-unit" key={index}><strong>{pad(value)}</strong><span>{["Ngày", "Giờ", "Phút", "Giây"][index]}</span></div>)}</div>{remaining === 0 && <p className="event-today">Ngày đáng nhớ đã đến rồi!</p>}</> : <p className="placeholder-copy">Điền ngày giờ tổ chức để xem đếm ngược.</p>}
      </section>
      <section className="directions-section" aria-labelledby="directions-title"><h3 id="directions-title">Xem đường đến buổi lễ</h3>
        <p>{ceremony.venue.trim() || "Địa điểm tổ chức"}<br /><span>{ceremony.address.trim() || "Địa chỉ sẽ hiển thị tại đây"}</span></p>
        {mapQuery && <iframe title="Bản đồ địa điểm tổ chức" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} />}
        {mapQuery && <a className="map-action" href={mapHref} target="_blank" rel="noopener noreferrer">Mở Google Maps ↗</a>}
      </section>
      <section className="rsvp-section" aria-labelledby="rsvp-title"><h3 id="rsvp-title">Xác nhận tham dự</h3>
        {code ? <form onSubmit={sendReply} className="rsvp-form">
          <label htmlFor="reply-name">Tên của bạn</label><input id="reply-name" required maxLength={60} value={replyName} onChange={e => setReplyName(e.target.value.normalize("NFC"))} />
          <label htmlFor="reply-attendance">Bạn sẽ tham dự chứ?</label><select id="reply-attendance" value={attendance} onChange={e => setAttendance(e.target.value as "yes" | "no" | "maybe")}><option value="yes">Mình sẽ tham dự</option><option value="maybe">Mình chưa chắc</option><option value="no">Mình không thể tham dự</option></select>
          <label htmlFor="reply-message">Gửi lời chúc</label><textarea id="reply-message" rows={4} maxLength={300} placeholder="Một lời nhắn dành cho ngày tốt nghiệp..." value={message} onChange={e => setMessage(e.target.value.normalize("NFC"))} />
          <p className="public-note">Phản hồi và lời chúc chỉ được gửi riêng cho người tạo thiệp.</p>
          <button className="primary-action" disabled={sending} type="submit">{sending ? "Đang gửi..." : "Gửi xác nhận và lời chúc ♥"}</button>
        </form> : <div className="rsvp-preview"><p className="preview-note">Mẫu xác nhận dành cho khách mời. Biểu mẫu sẽ hoạt động khi họ mở link thiệp riêng.</p><label>Tên của bạn<input disabled placeholder="Tên khách mời" /></label><label>Bạn sẽ tham dự chứ?<select disabled><option>Mình sẽ tham dự</option></select></label><label>Gửi lời chúc<textarea disabled rows={3} placeholder="Một lời nhắn dành cho ngày tốt nghiệp..." /></label><button className="primary-action" disabled>Gửi xác nhận và lời chúc ♥</button></div>}
        {replyNotice && <p className="reply-notice" role="status">{replyNotice}</p>}
      </section>
      <footer className="thank-you"><span>✦</span><h3>Cảm ơn bạn!</h3><p>Sự đồng hành của bạn khiến ngày tốt nghiệp này thêm trọn vẹn. Mong được gặp bạn trong khoảnh khắc đặc biệt ấy.</p><small>HỌC VIỆN HÀNG KHÔNG VIỆT NAM · {year || "2026"}</small></footer>
    </article></div>
  </main>;
}
