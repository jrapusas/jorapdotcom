"""Convert Hugo shortcodes in blog markdown to static HTML for OKF export."""

from __future__ import annotations

import html
import re
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT


STATIC_DIR = ROOT / "static"

OPEN_ANGLE_RE = re.compile(r"\{\{<([^>]+)>\}\}")
OPEN_PERCENT_RE = re.compile(r"\{\{%([^%]+)%\}\}")
# ponytail: naive paired-shortcode scan; upgrade path is Hugo render pass if nested cases break
PAIRED_RE = re.compile(r"\{\{<\s*(\w+)([^>]*)>\}\}(.*?)\{\{<\s*/\1\s*>\}\}", re.S)


def abs_site_url(base_url: str, path: str) -> str:
    if path.startswith(("http://", "https://")):
        return path
    if not path.startswith("/"):
        path = "/" + path
    return base_url.rstrip("/") + path


def parse_attrs(attr_text: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    text = attr_text.strip()
    if not text:
        return attrs

    pos = 0
    while pos < len(text):
        quoted = re.match(r'\s*"([^"]*)"|\'([^\']*)\'', text[pos:])
        if quoted:
            value = quoted.group(1) or quoted.group(2)
            key = "type" if "type" not in attrs else f"arg{len(attrs)}"
            if "type" not in attrs and not any(c in text[: pos + quoted.start()] for c in "="):
                key = "type"
            attrs[key] = value
            pos += quoted.end()
            continue

        named = re.match(r'\s*(\w+)=(?:"([^"]*)"|\'([^\']*)\'|(\S+))', text[pos:])
        if named:
            attrs[named.group(1)] = named.group(2) or named.group(3) or named.group(4)
            pos += named.end()
            continue

        bare = re.match(r"\s*(\S+)", text[pos:])
        if bare:
            token = bare.group(1)
            if "id" not in attrs:
                attrs["id"] = token
            elif "type" not in attrs:
                attrs["type"] = token
            pos += bare.end()
            continue
        pos += 1
    return attrs


def inner_html(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    escaped = html.escape(text)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', escaped)
    return "\n".join(f"<p>{line}</p>" for line in escaped.split("\n\n") if line.strip())


def html_youtube(attrs: dict[str, str], base_url: str) -> str:
    video_id = attrs.get("id", "").strip()
    if not video_id:
        return ""
    title = html.escape(attrs.get("title", "YouTube Video"))
    embed = f"https://www.youtube.com/embed/{html.escape(video_id, quote=True)}"
    return (
        f'<div class="youtube-video" style="position:relative;padding-bottom:56.25%;'
        f'height:0;overflow:hidden;">\n'
        f'  <iframe src="{embed}" title="{title}" loading="lazy" allowfullscreen '
        f'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>\n'
        f"</div>"
    )


def html_youtube_time(attrs: dict[str, str], base_url: str) -> str:
    video_id = attrs.get("id", "").strip()
    if not video_id:
        return ""
    title = html.escape(attrs.get("title", "YouTube Video"))
    params: list[str] = []
    if attrs.get("start"):
        params.append(f"start={html.escape(attrs['start'], quote=True)}")
    if attrs.get("end"):
        params.append(f"end={html.escape(attrs['end'], quote=True)}")
    query = ("?" + "&".join(params)) if params else ""
    embed = f"https://www.youtube.com/embed/{html.escape(video_id, quote=True)}{query}"
    return (
        f'<div class="youtube-video" style="position:relative;padding-bottom:56.25%;'
        f'height:0;overflow:hidden;">\n'
        f'  <iframe src="{embed}" title="{title}" loading="lazy" allowfullscreen '
        f'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>\n'
        f"</div>"
    )


def html_image(attrs: dict[str, str], base_url: str) -> str:
    src = attrs.get("src", "").strip()
    if not src:
        return ""
    url = abs_site_url(base_url, src if src.startswith("/") else f"/{src}")
    alt = html.escape(attrs.get("alt", attrs.get("title", "")))
    title = html.escape(attrs.get("title", ""))
    width = html.escape(attrs.get("width", ""))
    height = html.escape(attrs.get("height", ""))
    size = ""
    if width:
        size += f' width="{width}"'
    if height:
        size += f' height="{height}"'
    caption = attrs.get("caption", "").strip()
    img = (
        f'<img src="{html.escape(url, quote=True)}" alt="{alt}" title="{title}"'
        f' loading="lazy" decoding="async"{size} />'
    )
    if caption:
        cap = html.escape(caption)
        return f"<figure>\n  {img}\n  <figcaption>{cap}</figcaption>\n</figure>"
    return img


def html_spotify_track(attrs: dict[str, str], base_url: str) -> str:
    track_id = attrs.get("id", "").strip()
    if not track_id:
        return ""
    height = html.escape(attrs.get("height", "352"))
    src = f"https://open.spotify.com/embed/track/{html.escape(track_id, quote=True)}?utm_source=generator"
    return (
        f'<iframe style="border-radius:12px" src="{src}" width="100%" height="{height}" '
        f'frameborder="0" allowfullscreen loading="lazy" '
        f'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>'
    )


def html_spotify_artist(attrs: dict[str, str], base_url: str) -> str:
    artist_id = attrs.get("id", "").strip()
    if not artist_id:
        return ""
    height = html.escape(attrs.get("height", "352"))
    src = f"https://open.spotify.com/embed/artist/{html.escape(artist_id, quote=True)}?utm_source=generator"
    return (
        f'<iframe style="border-radius:12px" src="{src}" width="100%" height="{height}" '
        f'frameborder="0" allowfullscreen loading="lazy" '
        f'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>'
    )


def html_video(attrs: dict[str, str], base_url: str) -> str:
    src = attrs.get("src", "").strip()
    if not src:
        return ""
    url = abs_site_url(base_url, src) if not src.startswith("http") else src
    width = attrs.get("width", "")
    height = attrs.get("height", "")
    controls = attrs.get("controls", "true").lower() != "false"
    attrs_html = f' src="{html.escape(url, quote=True)}"'
    if width:
        attrs_html += f' width="{html.escape(width)}"'
    if height:
        attrs_html += f' height="{html.escape(height)}"'
    if controls:
        attrs_html += " controls"
    class_name = html.escape(attrs.get("class", ""))
    if class_name:
        attrs_html += f' class="{class_name}"'
    return f"<video{attrs_html}></video>"


def html_button(attrs: dict[str, str], base_url: str) -> str:
    label = html.escape(attrs.get("label", "Link"))
    link = attrs.get("link", "").strip()
    if not link:
        return ""
    href = abs_site_url(base_url, link) if not link.startswith("http") else link
    style = attrs.get("style", "solid")
    class_name = "btn btn-outline-primary" if style == "outline" else "btn btn-primary"
    rel = ' rel="noopener"' if href.startswith("http") else ""
    target = ' target="_blank"' if href.startswith("http") else ""
    return f'<a href="{html.escape(href, quote=True)}" class="{class_name}"{target}{rel}>{label}</a>'


def html_gallery(attrs: dict[str, str], base_url: str) -> str:
    folder = attrs.get("dir", "").strip().strip("/")
    if not folder:
        return ""
    gallery_dir = STATIC_DIR / folder
    if not gallery_dir.is_dir():
        return f"<p><em>Gallery images not found: {html.escape(folder)}</em></p>"
    parts = ['<div class="gallery">']
    for path in sorted(gallery_dir.iterdir()):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
            continue
        url = abs_site_url(base_url, f"/{folder}/{path.name}")
        parts.append(
            f'  <img src="{html.escape(url, quote=True)}" alt="{html.escape(path.stem)}" loading="lazy" />'
        )
    parts.append("</div>")
    return "\n".join(parts) if len(parts) > 2 else ""


def html_notice(notice_type: str, inner: str) -> str:
    label = html.escape(notice_type or "note")
    return (
        f'<aside class="notice {label}" role="note">\n'
        f"  <p><strong>{label.title()}</strong></p>\n"
        f"  <div>{inner_html(inner)}</div>\n"
        f"</aside>"
    )


def html_accordion(title: str, inner: str) -> str:
    summary = html.escape(title.strip('"'))
    return (
        f"<details class=\"accordion\">\n"
        f"  <summary>{summary}</summary>\n"
        f"  <div>{inner_html(inner)}</div>\n"
        f"</details>"
    )


def html_tab(title: str, inner: str) -> str:
    heading = html.escape(title.strip('"'))
    return f'<section class="tab-panel"><h3>{heading}</h3>{inner_html(inner)}</section>'


def html_toc(body: str) -> str:
    items: list[str] = []
    for match in re.finditer(r"^(#{2,3})\s+(.+)$", body, re.M):
        title = match.group(2).strip()
        anchor = re.sub(r"[^a-z0-9]+", "-", title.casefold()).strip("-")
        items.append(f'    <li><a href="#{anchor}">{html.escape(title)}</a></li>')
    if not items:
        return ""
    return "<nav class=\"toc\">\n  <ul>\n" + "\n".join(items) + "\n  </ul>\n</nav>"


SELF_CLOSING: dict[str, object] = {
    "youtube": html_youtube,
    "youtube_time": html_youtube_time,
    "image": html_image,
    "spotify_iframe_track": html_spotify_track,
    "spotify_iframe_artist": html_spotify_artist,
    "video": html_video,
    "button": html_button,
    "gallery": html_gallery,
}


def replace_self_closing(body: str, base_url: str) -> str:
    def repl_angle(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        if inner.startswith("/"):
            return match.group(0)
        parts = inner.split(None, 1)
        name = parts[0]
        attr_text = parts[1] if len(parts) > 1 else ""
        if name == "toc":
            return html_toc(body)
        handler = SELF_CLOSING.get(name)
        if not handler:
            return match.group(0)
        return handler(parse_attrs(attr_text), base_url)

    body = OPEN_ANGLE_RE.sub(repl_angle, body)
    return OPEN_PERCENT_RE.sub(repl_angle, body)


def replace_paired(body: str, base_url: str) -> str:
    changed = True
    while changed:
        changed = False

        def repl(match: re.Match[str]) -> str:
            nonlocal changed
            changed = True
            name = match.group(1)
            attrs = parse_attrs(match.group(2))
            inner = match.group(3)
            if name == "notice":
                notice_type = attrs.get("type", "note")
                return html_notice(notice_type, inner)
            if name == "accordion":
                title = attrs.get("type", attrs.get("id", "Details"))
                return html_accordion(title, inner)
            if name == "tab":
                title = attrs.get("type", attrs.get("id", "Tab"))
                return html_tab(title, inner)
            if name == "tabs":
                return f'<div class="tabs">\n{inner}\n</div>'
            return match.group(0)

        body = PAIRED_RE.sub(repl, body, count=1)
    return body


def shortcodes_to_html(body: str, base_url: str) -> str:
    body = replace_paired(body, base_url)
    return replace_self_closing(body, base_url)


def _self_check() -> None:
    base = "https://www.jorap.com/"
    sample = 'Before\n\n{{< youtube kdUsythJKOg >}}\n\n{{< image src="images/x.jpg" alt="Alt" caption="Cap" >}}'
    out = shortcodes_to_html(sample, base)
    assert "iframe" in out and "kdUsythJKOg" in out
    assert '<img src="https://www.jorap.com/images/x.jpg"' in out
    assert "<figcaption>Cap</figcaption>" in out
    paired = '{{< notice "tip" >}}Try this.{{< /notice >}}'
    assert "<aside class=\"notice tip\"" in shortcodes_to_html(paired, base)


if __name__ == "__main__":
    _self_check()
    print("blog_shortcodes self-check OK")
