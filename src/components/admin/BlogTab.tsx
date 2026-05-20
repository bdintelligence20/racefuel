import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, FileText, Trash2, Eye, EyeOff, ExternalLink, ArrowLeft, ImagePlus, X } from 'lucide-react';
import {
  adminListPosts,
  adminUpsertPost,
  adminDeletePost,
  adminUploadImage,
  type AdminPostRow,
} from '../../services/firebase/admin';
import { Markdown } from '../../services/blog/markdown';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — matches the adminUploadImage cap
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      // Drop the "data:<mime>;base64," prefix — the callable wants raw base64.
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/** Validate + upload an image file via the admin callable; returns its public URL. */
async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large — max 8 MB.');
  const dataBase64 = await readFileAsBase64(file);
  const { url } = await adminUploadImage({ dataBase64, contentType: file.type, filename: file.name });
  return url;
}

/** Human-ish alt text from a filename: "sunset-run_02.jpg" → "sunset run 02". */
function altFromFilename(name: string): string {
  return name.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' ').trim() || 'image';
}

interface FormState {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  author: string;
  tags: string;
  readingMinutes: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  publishedAt: string; // datetime-local value, local TZ
}

const EMPTY_FORM: FormState = {
  id: null,
  slug: '',
  title: '',
  excerpt: '',
  body: '# New post\n\nWrite your post in Markdown.\n\nSupports **bold**, *italic*, `code`, [links](https://fuelcue.com), images, lists, code blocks and blockquotes.\n',
  coverImageUrl: '',
  author: 'Fuel Cue',
  tags: '',
  readingMinutes: '',
  seoTitle: '',
  seoDescription: '',
  published: false,
  publishedAt: '',
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDatetimeLocal(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const tzOff = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOff).toISOString().slice(0, 16);
}

function fromDatetimeLocal(s: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

function rowToForm(row: AdminPostRow): FormState {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? '',
    body: row.body,
    coverImageUrl: row.coverImageUrl ?? '',
    author: row.author,
    tags: row.tags.join(', '),
    readingMinutes: row.readingMinutes != null ? String(row.readingMinutes) : '',
    seoTitle: row.seoTitle ?? '',
    seoDescription: row.seoDescription ?? '',
    published: row.published,
    publishedAt: toDatetimeLocal(row.publishedAt),
  };
}

export function BlogTab() {
  const [rows, setRows] = useState<AdminPostRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const refresh = async () => {
    try {
      const res = await adminListPosts();
      setRows(res.rows);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load posts.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (filter === 'all') return rows;
    return rows.filter((r) => (filter === 'published' ? r.published : !r.published));
  }, [rows, filter]);

  const openCreate = () => setEditing({ ...EMPTY_FORM });

  if (editing) {
    return (
      <Editor
        form={editing}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSaved={async () => { await refresh(); setEditing(null); }}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Blog</h1>
        <button
          onClick={openCreate}
          className="ml-auto px-4 py-2 rounded-xl bg-[#3D2152] text-white text-[11.5px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New post
        </button>
      </div>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>
      )}

      <div className="flex gap-1.5">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-[#3D2152] text-white'
                : 'bg-white border border-[#3D2152]/10 text-[#6B5A7A] hover:bg-[#FFF9F0]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="bg-white border border-[#3D2152]/10 rounded-2xl shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)] overflow-hidden">
        {!filtered ? (
          <div className="px-5 py-8 text-[12px] text-[#A0929E] flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileText className="w-10 h-10 text-[#A0929E] mx-auto mb-2" />
            <p className="text-[12.5px] text-[#6B5A7A] font-display">No posts {filter !== 'all' ? `(${filter})` : 'yet'}.</p>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-[#FFF9F0] text-[10px] uppercase tracking-[0.16em] text-[#A0929E] font-display font-bold">
              <tr>
                <th className="text-left px-4 py-2.5">Title</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Published</th>
                <th className="text-left px-4 py-2.5">Updated</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-[#3D2152]/[0.06] hover:bg-[#FFF9F0]/60">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditing(rowToForm(r))}
                      className="text-left text-[#3D2152] hover:text-[#F5A020] transition-colors font-display font-semibold"
                    >
                      {r.title}
                    </button>
                    <div className="text-[10.5px] text-[#A0929E] mt-0.5 font-mono">/{r.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.published ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1E8E3E] bg-[#1E8E3E]/[0.08] px-2 py-0.5 rounded">
                        <Eye className="w-3 h-3" /> Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#A0929E] bg-[#3D2152]/[0.06] px-2 py-0.5 rounded">
                        <EyeOff className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#6B5A7A]">{formatDate(r.publishedAt)}</td>
                  <td className="px-4 py-3 text-[#6B5A7A]">{formatDate(r.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.published && (
                      <a
                        href={`/blog/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-[#F5A020]/10 text-[#A0929E] hover:text-[#F5A020] transition-colors mr-1"
                        aria-label={`View ${r.title} on the site`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${r.title}"? This is permanent.`)) return;
                        try {
                          await adminDeletePost({ id: r.id });
                          await refresh();
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : 'Delete failed.');
                        }
                      }}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-[#E8671A]/10 text-[#A0929E] hover:text-[#E8671A] transition-colors"
                      aria-label={`Delete ${r.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Editor({
  form,
  onChange,
  onClose,
  onSaved,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [coverUploading, setCoverUploading] = useState(false);
  const [bodyUploading, setBodyUploading] = useState(false);

  // Always-current form snapshot — async upload handlers resolve after the
  // closure's `form` may be stale (e.g. title edited mid-upload), so they
  // write back from this ref instead.
  const formRef = useRef(form);
  formRef.current = form;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const patch = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    onChange({ ...form, [k]: v });

  // Upload a cover image and store its URL on the post.
  const onCoverFile = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setCoverUploading(true);
    try {
      const url = await uploadImage(file);
      onChange({ ...formRef.current, coverImageUrl: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cover image upload failed.');
    } finally {
      setCoverUploading(false);
    }
  };

  // Upload an image and splice a Markdown image tag into the body at the
  // caret (or the end of the body if the editor isn't focused).
  const onBodyImageFile = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setBodyUploading(true);
    try {
      const url = await uploadImage(file);
      const ta = bodyRef.current;
      const body = formRef.current.body;
      const at = ta ? ta.selectionStart : body.length;
      const snippet = `\n\n![${altFromFilename(file.name)}](${url})\n\n`;
      onChange({ ...formRef.current, body: body.slice(0, at) + snippet + body.slice(at) });
      requestAnimationFrame(() => {
        const el = bodyRef.current;
        if (el) {
          el.focus();
          const pos = at + snippet.length;
          el.setSelectionRange(pos, pos);
        }
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setBodyUploading(false);
    }
  };

  // Auto-derive slug from title until the user types into the slug field.
  const onTitleChange = (title: string) => {
    if (!form.id && (form.slug === '' || form.slug === slugify(form.title))) {
      onChange({ ...form, title, slug: slugify(title) });
    } else {
      patch('title', title);
    }
  };

  const save = async (markPublished?: boolean) => {
    setSaving(true);
    setErr(null);
    try {
      const result = await adminUpsertPost({
        id: form.id,
        slug: form.slug.trim(),
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        body: form.body,
        coverImageUrl: form.coverImageUrl.trim() || null,
        author: form.author.trim() || 'Fuel Cue',
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        readingMinutes: form.readingMinutes.trim() === '' ? null : Number(form.readingMinutes),
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        published: markPublished ?? form.published,
        publishedAt: fromDatetimeLocal(form.publishedAt) ?? Date.now(),
      });
      // Reflect saved state so subsequent saves update vs create.
      onChange({ ...form, id: result.id, slug: result.slug, published: markPublished ?? form.published });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-[11.5px] font-display font-bold uppercase tracking-wider text-[#6B5A7A] hover:text-[#3D2152]">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to posts
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => save(false)}
            disabled={saving || !form.title.trim() || !form.body.trim()}
            className="px-4 py-2 rounded-xl bg-white border border-[#3D2152]/10 text-[11.5px] font-display font-bold text-[#3D2152] hover:bg-[#FFF9F0] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || !form.title.trim() || !form.body.trim()}
            className="px-4 py-2 rounded-xl bg-[#F5A020] text-white text-[11.5px] font-display font-bold hover:bg-[#F5A020]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {form.published ? 'Save & keep live' : 'Publish'}
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 space-y-3">
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="A clear, search-friendly headline"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[15px] font-display font-bold text-[#3D2152] placeholder:text-[#A0929E] placeholder:font-normal focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
            <Field label="Slug">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#A0929E] font-mono">/blog/</span>
                <input
                  value={form.slug}
                  onChange={(e) => patch('slug', slugify(e.target.value))}
                  placeholder="kebab-case-slug"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] font-mono text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
                />
              </div>
            </Field>
            <Field label="Excerpt (shown in the list + meta description fallback)">
              <textarea
                value={form.excerpt}
                onChange={(e) => patch('excerpt', e.target.value)}
                rows={2}
                maxLength={320}
                placeholder="One or two sentences."
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
          </div>

          <div className="bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden">
            <div className="flex border-b border-[#3D2152]/10 bg-[#FFF9F0]">
              <button
                onClick={() => setPane('edit')}
                className={`px-4 py-2 text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${pane === 'edit' ? 'bg-white text-[#3D2152]' : 'text-[#6B5A7A] hover:text-[#3D2152]'}`}
              >
                Write
              </button>
              <button
                onClick={() => setPane('preview')}
                className={`px-4 py-2 text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${pane === 'preview' ? 'bg-white text-[#3D2152]' : 'text-[#6B5A7A] hover:text-[#3D2152]'}`}
              >
                Preview
              </button>
              <label
                className={`ml-auto flex items-center gap-1.5 px-3 py-2 text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${
                  bodyUploading ? 'text-[#A0929E] pointer-events-none' : 'text-[#6B5A7A] hover:text-[#3D2152] cursor-pointer'
                }`}
                title="Upload an image and insert it into the post body"
              >
                {bodyUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                Insert image
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  disabled={bodyUploading}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    setPane('edit');
                    void onBodyImageFile(file);
                  }}
                />
              </label>
              <div className="px-3 py-2 text-[10px] text-[#A0929E] font-display">
                Markdown · {form.body.split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
            {pane === 'edit' ? (
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => patch('body', e.target.value)}
                rows={24}
                className="w-full px-4 py-3 bg-white text-[14px] font-mono text-[#3D2152] focus:outline-none resize-y"
                placeholder="Write your post in Markdown…"
                spellCheck
              />
            ) : (
              <div className="px-6 py-5 max-h-[640px] overflow-y-auto">
                <Markdown source={form.body} />
              </div>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-3">
          <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 space-y-3">
            <div className="text-[10px] font-display uppercase tracking-[0.16em] font-bold text-[#A0929E] mb-1">Publish</div>
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => patch('published', e.target.checked)}
                className="w-4 h-4 accent-[#F5A020]"
              />
              <span className="text-[12.5px] font-display font-semibold text-[#3D2152]">Published</span>
            </label>
            <Field label="Publish date">
              <input
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => patch('publishedAt', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
              <p className="text-[10px] text-[#A0929E] mt-1">Future dates schedule the post — it stays hidden until then.</p>
            </Field>
          </div>

          <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 space-y-3">
            <div className="text-[10px] font-display uppercase tracking-[0.16em] font-bold text-[#A0929E]">Presentation</div>
            <Field label="Cover image">
              {form.coverImageUrl ? (
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-[#3D2152]/10 bg-[#FFF9F0]">
                  {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                  <img src={form.coverImageUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => patch('coverImageUrl', '')}
                    className="absolute top-1.5 right-1.5 w-7 h-7 inline-flex items-center justify-center rounded-lg bg-white/90 text-[#6B5A7A] hover:text-[#E8671A] shadow-sm transition-colors"
                    aria-label="Remove cover image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={`flex flex-col items-center justify-center gap-1 aspect-[16/9] w-full rounded-lg border-2 border-dashed border-[#3D2152]/15 bg-[#FFF9F0] transition-colors ${
                    coverUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:border-[#F5A020]/50'
                  }`}
                >
                  {coverUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#F5A020]" />
                  ) : (
                    <>
                      <ImagePlus className="w-6 h-6 text-[#A0929E]" />
                      <span className="text-[11.5px] font-display font-bold text-[#6B5A7A]">Upload cover image</span>
                      <span className="text-[10px] text-[#A0929E]">JPEG · PNG · WebP — max 8 MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    disabled={coverUploading}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      void onCoverFile(file);
                    }}
                  />
                </label>
              )}
            </Field>
            <Field label="Author">
              <input
                value={form.author}
                onChange={(e) => patch('author', e.target.value)}
                placeholder="Fuel Cue"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                value={form.tags}
                onChange={(e) => patch('tags', e.target.value)}
                placeholder="ultra, nutrition, gels"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
            <Field label="Reading minutes">
              <input
                type="number"
                min="1"
                max="60"
                value={form.readingMinutes}
                onChange={(e) => patch('readingMinutes', e.target.value)}
                placeholder="Auto if blank"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] tabular-nums text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
          </div>

          <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 space-y-3">
            <div className="text-[10px] font-display uppercase tracking-[0.16em] font-bold text-[#A0929E]">SEO</div>
            <Field label="SEO title (max 70)">
              <input
                value={form.seoTitle}
                onChange={(e) => patch('seoTitle', e.target.value)}
                maxLength={70}
                placeholder="Defaults to title"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
            <Field label="SEO description (max 200)">
              <textarea
                value={form.seoDescription}
                onChange={(e) => patch('seoDescription', e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="Defaults to excerpt"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-display uppercase tracking-[0.16em] font-bold text-[#A0929E] mb-1.5">{label}</div>
      {children}
    </label>
  );
}
