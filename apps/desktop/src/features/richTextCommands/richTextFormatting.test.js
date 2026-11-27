import { afterEach, describe, expect, it, vi } from "vitest";
import { insertRichTextChecklist, RICH_TEXT_CHECKED_ATTRIBUTE, RICH_TEXT_CHECKLIST_ATTRIBUTE } from "./richTextFormatting";
class TestElement {
    tagName;
    nodeType = 1;
    childNodes = [];
    attributes = new Map();
    parentElement = null;
    constructor(tagName) {
        this.tagName = tagName;
    }
    append(...children) {
        children.forEach((child) => {
            if (child.parentElement) {
                const siblings = child.parentElement.childNodes;
                siblings.splice(siblings.indexOf(child), 1);
            }
            child.parentElement = this;
            this.childNodes.push(child);
        });
    }
    before(sibling) {
        const parent = this.parentElement;
        if (!parent)
            return;
        sibling.parentElement = parent;
        parent.childNodes.splice(parent.childNodes.indexOf(this), 0, sibling);
    }
    after(sibling) {
        const parent = this.parentElement;
        if (!parent)
            return;
        sibling.parentElement = parent;
        parent.childNodes.splice(parent.childNodes.indexOf(this) + 1, 0, sibling);
    }
    contains(element) {
        for (let current = element; current; current = current.parentElement) {
            if (current === this)
                return true;
        }
        return false;
    }
    closest(selector) {
        const tags = selector.toUpperCase().split(/,\s*/);
        for (let current = this; current; current = current.parentElement) {
            if (tags.includes(current.tagName))
                return current;
        }
        return null;
    }
    querySelectorAll(selector) {
        if (selector === ":scope > li")
            return this.childNodes.filter((child) => child.tagName === "LI");
        const matches = [];
        const visit = (element) => {
            element.childNodes.forEach((child) => {
                if (child.tagName.toLowerCase() === selector)
                    matches.push(child);
                visit(child);
            });
        };
        visit(this);
        return matches;
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus() { }
}
const list = (tagName, count = 1) => {
    const element = new TestElement(tagName);
    for (let index = 0; index < count; index += 1)
        element.append(new TestElement("LI"));
    return element;
};
const setSelection = (container, offset = 0) => {
    vi.stubGlobal("Node", { ELEMENT_NODE: 1 });
    let selectedRange = { startContainer: container, startOffset: offset };
    const selection = {
        get rangeCount() { return selectedRange ? 1 : 0; },
        getRangeAt: () => selectedRange,
        removeAllRanges: () => { },
        addRange: (range) => { selectedRange = range; },
    };
    vi.stubGlobal("window", {
        getSelection: () => selection,
    });
    return selection;
};
const stubDocument = (execCommand) => vi.stubGlobal("document", {
    execCommand: vi.fn(execCommand),
    createElement: (tagName) => new TestElement(tagName.toUpperCase()),
    createRange: () => ({
        startContainer: null,
        startOffset: 0,
        selectNodeContents(item) { this.startContainer = item; },
        collapse() { },
    }),
});
afterEach(() => vi.unstubAllGlobals());
describe("insertRichTextChecklist", () => {
    it.each(["empty editor", "text paragraph"])("marks the first native list from an %s when the caret stays at the editor boundary", (source) => {
        const editor = new TestElement("DIV");
        if (source === "text paragraph")
            editor.append(new TestElement("P"));
        const unrelated = list("UL");
        if (source === "text paragraph")
            editor.append(unrelated);
        const selection = setSelection(editor, 0);
        stubDocument(() => {
            const created = list("UL");
            created.parentElement = editor;
            editor.childNodes.splice(0, source === "empty editor" ? 0 : 1, created);
            return true;
        });
        expect(insertRichTextChecklist(editor)).toBe(true);
        expect(editor.childNodes[0].getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBe("true");
        expect(editor.childNodes[0].childNodes[0].getAttribute(RICH_TEXT_CHECKED_ATTRIBUTE)).toBe("false");
        expect(unrelated.getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBeNull();
        expect(selection.getRangeAt().startContainer).toBe(editor.childNodes[0].childNodes[0]);
        expect(document.execCommand).toHaveBeenCalledOnce();
    });
    it("converts the selected bullet list without toggling it off or resetting checked items", () => {
        const editor = new TestElement("DIV");
        const bullets = list("UL", 2);
        bullets.childNodes[0].setAttribute(RICH_TEXT_CHECKED_ATTRIBUTE, "true");
        editor.append(bullets);
        setSelection(bullets.childNodes[0]);
        stubDocument(() => true);
        expect(insertRichTextChecklist(editor)).toBe(true);
        expect(bullets.getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBe("true");
        expect(bullets.childNodes.map((item) => item.getAttribute(RICH_TEXT_CHECKED_ATTRIBUTE))).toEqual(["true", "false"]);
        expect(document.execCommand).not.toHaveBeenCalled();
    });
    it("does not convert a following bullet list when the caret is before it", () => {
        const editor = new TestElement("DIV");
        const followingBullets = list("UL");
        editor.append(followingBullets);
        setSelection(editor, 0);
        stubDocument(() => {
            const created = list("UL");
            created.parentElement = editor;
            editor.childNodes.unshift(created);
            return true;
        });
        expect(insertRichTextChecklist(editor)).toBe(true);
        expect(editor.childNodes[0].getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBe("true");
        expect(followingBullets.getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBeNull();
    });
    it.each(["before", "after"])("splits a new item %s existing bullets when the browser merges them", (position) => {
        const editor = new TestElement("DIV");
        const existingBullets = list("UL");
        const originalItem = existingBullets.childNodes[0];
        editor.append(existingBullets);
        const selection = setSelection(editor, position === "before" ? 0 : 1);
        stubDocument(() => {
            const createdItem = new TestElement("LI");
            createdItem.parentElement = existingBullets;
            if (position === "before")
                existingBullets.childNodes.unshift(createdItem);
            else
                existingBullets.childNodes.push(createdItem);
            return true;
        });
        expect(insertRichTextChecklist(editor)).toBe(true);
        expect(editor.childNodes).toHaveLength(2);
        const newList = editor.childNodes[position === "before" ? 0 : 1];
        expect(newList.getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBe("true");
        expect(newList.childNodes[0].getAttribute(RICH_TEXT_CHECKED_ATTRIBUTE)).toBe("false");
        expect(editor.childNodes[position === "before" ? 1 : 0]).toBe(existingBullets);
        expect(existingBullets.childNodes).toEqual([originalItem]);
        expect(existingBullets.getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBeNull();
        expect(selection.getRangeAt().startContainer).toBe(newList.childNodes[0]);
    });
    it("marks an ordered list converted by the browser even when selection no longer points into it", () => {
        const editor = new TestElement("DIV");
        const ordered = list("OL");
        editor.append(ordered);
        setSelection(ordered.childNodes[0]);
        stubDocument(() => {
            const converted = list("UL");
            converted.parentElement = editor;
            editor.childNodes.splice(0, 1, converted);
            setSelection(editor, 1);
            return true;
        });
        expect(insertRichTextChecklist(editor)).toBe(true);
        expect(editor.childNodes[0].getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE)).toBe("true");
        expect(editor.childNodes[0].childNodes[0].getAttribute(RICH_TEXT_CHECKED_ATTRIBUTE)).toBe("false");
    });
});
