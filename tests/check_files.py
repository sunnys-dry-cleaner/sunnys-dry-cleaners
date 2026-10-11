"""
Checks the website files before they go live.
Run it yourself with:  python tests/check_files.py

It looks for:
  - HTML tags that were opened but never closed (or closed in the wrong order)
  - the same id used twice
  - links to sections (#something) that don't exist on the page
  - images, CSS files or other files that are linked but missing,
    including wrong capital letters (GitHub Pages is case-sensitive)
"""
from html.parser import HTMLParser
from pathlib import Path
import os
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

# Tags that never have a closing tag
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input",
             "link", "meta", "source", "track", "wbr", "path", "circle", "line",
             "rect", "polygon", "polyline", "ellipse"}

# Tags the browser lets you leave open (we still close ours, but don't fail on them)
OPTIONAL_CLOSE = {"p", "li", "option", "td", "th", "tr"}


class PageChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.open_tags = []      # stack of (tag, line)
        self.ids = set()
        self.links = []          # (url, line)
        self.errors = []

    def remember(self, tag, attrs):
        line = self.getpos()[0]
        attrs = dict(attrs)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                self.errors.append(f"line {line}: id \"{attrs['id']}\" is used more than once")
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            if attrs.get(key):
                self.links.append((attrs[key], line))

    def handle_starttag(self, tag, attrs):
        self.remember(tag, attrs)
        if tag not in VOID_TAGS:
            self.open_tags.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.remember(tag, attrs)

    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        line = self.getpos()[0]
        names = [t for t, _ in self.open_tags]
        if tag not in names:
            self.errors.append(f"line {line}: </{tag}> closes a tag that was never opened")
            return
        # Close back to the matching tag, reporting anything left open in between
        while self.open_tags:
            open_tag, open_line = self.open_tags.pop()
            if open_tag == tag:
                break
            if open_tag not in OPTIONAL_CLOSE:
                self.errors.append(f"line {open_line}: <{open_tag}> is never closed (found </{tag}> on line {line} first)")


def file_exists_exact_case(relative):
    """True only if the file exists with exactly these capital letters."""
    path = ROOT
    for part in Path(relative).parts:
        if part in ("", "."):
            continue
        if not path.is_dir() or part not in os.listdir(path):
            return False
        path = path / part
    return path.is_file()


def is_local(url):
    return not re.match(r"^(https?:|mailto:|tel:|data:|//)", url)


def main():
    errors = []

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    checker = PageChecker()
    checker.feed(html)
    checker.close()
    errors += checker.errors
    for tag, line in checker.open_tags:
        if tag not in OPTIONAL_CLOSE:
            errors.append(f"line {line}: <{tag}> is never closed")

    for url, line in checker.links:
        if not is_local(url):
            continue
        if url.startswith("#"):
            if url != "#" and url[1:] not in checker.ids:
                errors.append(f"index.html line {line}: link to {url} but no element has id=\"{url[1:]}\"")
        else:
            path = url.split("#")[0].split("?")[0]
            if path and not file_exists_exact_case(path):
                errors.append(f"index.html line {line}: \"{path}\" is missing (check the spelling and capital letters)")

    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    for number, text in enumerate(css.splitlines(), start=1):
        for url in re.findall(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", text):
            if is_local(url) and not file_exists_exact_case(url):
                errors.append(f"styles.css line {number}: \"{url}\" is missing (check the spelling and capital letters)")

    if errors:
        print("Problems found:")
        for error in errors:
            print("  - " + error)
        sys.exit(1)

    print(f"OK: tags balanced, {len(checker.ids)} ids, {len(checker.links)} links and images checked.")


if __name__ == "__main__":
    main()
