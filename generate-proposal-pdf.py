#!/usr/bin/env python3
"""Generate a simple MarketPollen options PDF."""

from pathlib import Path

import cairosvg
from fpdf import FPDF

GOLD = (245, 166, 35)
GOLD_SOFT = (255, 236, 204)
DARK = (36, 36, 36)
GRAY = (95, 95, 95)
MUTED = (130, 130, 130)
LIGHT_BG = (255, 250, 242)
WHITE = (255, 255, 255)
CARD_BORDER = (230, 220, 205)
ROW_ALT = (252, 247, 240)

PAGE_W = 210
MARGIN = 18
CONTENT_W = PAGE_W - 2 * MARGIN

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "web" / "public" / "assets"
CACHE = ROOT / ".pdf-assets"


def prepare_assets():
    CACHE.mkdir(exist_ok=True)
    logo_png = CACHE / "horizontal.png"
    cairosvg.svg2png(
        url=str(ASSETS / "source-horizontal.svg"),
        write_to=str(logo_png),
        output_width=1200,
        output_height=196,
    )
    return logo_png


class ProposalPDF(FPDF):
    def __init__(self, logo_path):
        super().__init__(unit="mm", format="A4")
        self.logo_path = str(logo_path)
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(MARGIN, 16, MARGIN)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-12)
        self.set_draw_color(*GOLD)
        self.set_line_width(0.4)
        self.line(MARGIN, self.get_y(), PAGE_W - MARGIN, self.get_y())
        self.set_y(-10)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(CONTENT_W / 2, 5, "MarketPollen", align="L")
        self.cell(CONTENT_W / 2, 5, f"Page {self.page_no()}", align="R")

    def _gold_rule(self, width=40, centered=True):
        y = self.get_y()
        self.set_draw_color(*GOLD)
        self.set_line_width(1.2)
        x = (PAGE_W - width) / 2 if centered else MARGIN
        self.line(x, y, x + width, y)

    def _section_title(self, title):
        self.ln(3)
        y = self.get_y()
        self.set_fill_color(*GOLD)
        self.rect(MARGIN, y + 1, 3.5, 7, "F")
        self.set_xy(MARGIN + 7, y)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*DARK)
        self.cell(0, 9, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1.5)

    def _body(self, text, size=10, leading=5.2):
        self.set_font("Helvetica", "", size)
        self.set_text_color(*GRAY)
        self.set_x(MARGIN)
        self.multi_cell(CONTENT_W, leading, text)
        self.ln(1)

    def _option_card(self, number, title, price_line, body_lines):
        y0 = self.get_y()
        # Estimate height from content
        h = 12 + 7 + len(body_lines) * 5.2 + 8
        self.set_fill_color(*WHITE)
        self.set_draw_color(*CARD_BORDER)
        self.set_line_width(0.4)
        self.rect(MARGIN, y0, CONTENT_W, h, "DF")

        # Number badge
        self.set_fill_color(*GOLD)
        self.ellipse(MARGIN + 4, y0 + 4, 8, 8, "F")
        self.set_xy(MARGIN + 4, y0 + 4.8)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*WHITE)
        self.cell(8, 6, str(number), align="C")

        self.set_xy(MARGIN + 16, y0 + 4)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*DARK)
        self.cell(90, 7, title)

        self.set_xy(MARGIN + 16, y0 + 11)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*GOLD)
        self.cell(CONTENT_W - 24, 6, price_line)

        ty = y0 + 20
        for line in body_lines:
            self.set_xy(MARGIN + 16, ty)
            self.set_font("Helvetica", "", 9.5)
            self.set_text_color(*GRAY)
            self.multi_cell(CONTENT_W - 28, 5, line)
            ty = self.get_y() + 0.5

        self.set_y(y0 + h + 4)

    def cover(self):
        self.add_page()
        self.set_fill_color(*LIGHT_BG)
        self.rect(0, 0, PAGE_W, 297, "F")
        self.set_fill_color(*GOLD)
        self.rect(0, 0, PAGE_W, 8, "F")

        logo_w, logo_h = 110, 18
        self.image(self.logo_path, x=(PAGE_W - logo_w) / 2, y=78, w=logo_w, h=logo_h)

        self.set_y(125)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*GOLD)
        self.cell(0, 8, "A FEW WAYS FORWARD", align="C", new_x="LMARGIN", new_y="NEXT")

        self.ln(2)
        self.set_font("Helvetica", "B", 26)
        self.set_text_color(*DARK)
        self.cell(0, 12, "Keep MarketPollen humming.", align="C", new_x="LMARGIN", new_y="NEXT")

        self.ln(4)
        self._gold_rule(width=40)
        self.ln(12)

        self.set_font("Helvetica", "", 12)
        self.set_text_color(*GRAY)
        self.multi_cell(
            CONTENT_W,
            6.5,
            "Following our conversation -- a simple look at a few options.",
            align="C",
        )

        self.set_y(250)
        self.set_font("Helvetica", "I", 11)
        self.set_text_color(*GRAY)
        self.cell(0, 6, "", align="C")

        self.set_fill_color(*GOLD)
        self.rect(0, 289, PAGE_W, 8, "F")

    def content(self):
        self.add_page()
        self._section_title("What's already in place")
        self._body(
            "MarketPollen is the custom platform your team uses for contacts, cake donations "
            "and reachouts, opportunity discovery, day routing, quarterly mouths tracking, "
            "per-store users, and AI help with notes, follow-ups, and outreach drafts. "
            "One place instead of a stack of separate tools."
        )

        self.ln(2)
        self._section_title("Options")
        self._body(
            "A few paths we talked about. You can mix pieces, or we can shape something "
            "that fits better -- this is a starting point."
        )
        self.ln(2)

        self._option_card(
            1,
            "Monthly managed service",
            "$95 per store / month",
            [
                "Covers hosting, support, security, unlimited AI & mapping, "
                "and keeping the app running. New store onboarding included. "
                "Month-to-month; cancel anytime.",
            ],
        )

        self._option_card(
            2,
            "Work put in so far",
            "15 hours x $150 / hour = $2,250",
            [
                "A straightforward estimate of the time already invested building "
                "and running MarketPollen.",
            ],
        )

        self._option_card(
            3,
            "Equity in MarketPollen",
            "Buy-in and ownership share -- let's define together",
            [
                "If you'd like to own a piece of the company behind the product, "
                "we can put together a fair buy-in and ownership split.",
            ],
        )

        self.ln(4)
        self._section_title("A note")
        self._body(
            "These aren't take-it-or-leave-it packages. If one path, a blend, or "
            "something different makes more sense after we talk, we can write that up cleanly."
        )


def main():
    logo = prepare_assets()
    out = ROOT / "Market_Pollen_Managed_Service_Proposal.pdf"
    pdf = ProposalPDF(logo)
    pdf.cover()
    pdf.content()
    pdf.output(str(out))
    print(f"PDF created: {out}")


if __name__ == "__main__":
    main()
