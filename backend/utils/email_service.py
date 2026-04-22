"""
Luna Group email service — powered by Resend.

All transactional email flows go through this module so we have one place
to (a) manage the Resend client, (b) enforce the branded sender, and (c)
maintain consistent visual treatment across templates.

Design notes
------------
* Resend's Python SDK is synchronous, so every public helper is async and
  uses `asyncio.to_thread(...)` so the FastAPI event loop stays unblocked.
* Every template is plain inline-CSS HTML (required by email clients).
* Sender is always from the verified lunagroup.com.au domain.
* If `RESEND_API_KEY` is missing the module degrades to logging-only so local
  dev still works; never raises to callers.
"""

import asyncio
import logging
import os
from typing import Optional

import resend

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ config

_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "Luna Group <noreply@lunagroup.com.au>")
APP_URL = os.environ.get("APP_PUBLIC_URL", "https://lunagroup.com.au")

if _API_KEY:
    resend.api_key = _API_KEY
else:
    logger.warning(
        "[email_service] RESEND_API_KEY not set — emails will only be logged, not delivered."
    )


# ------------------------------------------------------------------ core


async def _send(to: str, subject: str, html: str) -> Optional[str]:
    """Low-level send. Returns Resend email id on success, None on failure."""
    if not _API_KEY:
        logger.info(
            "[email_service] (no-op) would send to=%s subject=%s", to, subject
        )
        return None
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        resp = await asyncio.to_thread(resend.Emails.send, params)
        email_id = resp.get("id") if isinstance(resp, dict) else None
        logger.info(
            "[email_service] sent to=%s subject=%s id=%s", to, subject, email_id
        )
        return email_id
    except Exception as exc:  # pragma: no cover — never break caller
        logger.error("[email_service] send failed to=%s err=%s", to, exc)
        return None


# ------------------------------------------------------------------ template


_BRAND_GOLD = "#D4A832"
_BRAND_BG = "#050505"
_BRAND_CARD = "#0F0F0F"


def _wrap(content_html: str, preheader: str = "") -> str:
    """Apply Luna Group branded container to the given body HTML."""
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:{_BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#EAEAEA;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BRAND_BG};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:{_BRAND_CARD};border-radius:14px;border:1px solid #1A1A1A;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;text-align:center;">
                <div style="font-size:11px;letter-spacing:3px;color:{_BRAND_GOLD};text-transform:uppercase;font-weight:800;">Luna Group</div>
                <div style="margin-top:6px;font-size:10px;letter-spacing:2px;color:#6A6A6A;text-transform:uppercase;">Brisbane &middot; Gold Coast</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;">{content_html}</td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid #1A1A1A;text-align:center;font-size:11px;color:#6A6A6A;">
                You received this email because you have a Luna Group account.<br>
                <a href="{APP_URL}" style="color:{_BRAND_GOLD};text-decoration:none;">lunagroup.com.au</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _button(label: str, href: str) -> str:
    return f"""<div style="text-align:center;margin:28px 0;">
  <a href="{href}" style="display:inline-block;padding:14px 36px;background:{_BRAND_GOLD};color:#000;font-weight:800;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:10px;">{label}</a>
</div>"""


# ------------------------------------------------------------------ flows


async def send_verification_email(email: str, name: str, token: str) -> str:
    """Sign-up verification link. Returns the verification link for logging."""
    link = f"{APP_URL}/verify-email?token={token}"
    content = f"""
    <h1 style="font-size:24px;font-weight:800;color:#FFF;margin:0 0 12px 0;">Welcome to Luna Group, {name.split(' ')[0] if name else 'there'}</h1>
    <p style="font-size:15px;line-height:1.6;color:#C0C0C0;margin:0 0 8px 0;">
      You're one step away from unlocking VIP booths, auctions, birthday rewards and points on every visit.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#C0C0C0;margin:0;">
      Tap below to verify your email and activate your account.
    </p>
    {_button("Verify Email", link)}
    <p style="font-size:12px;line-height:1.6;color:#6A6A6A;margin:24px 0 0 0;">
      This link expires in 24 hours. If the button doesn't work, paste this URL into your browser:<br>
      <span style="color:#9A9A9A;word-break:break-all;">{link}</span>
    </p>
    """
    await _send(email, "Verify your Luna Group account", _wrap(content, "Verify your email to activate your Luna Group account."))
    return link


async def send_password_reset_email(email: str, name: str, token: str) -> str:
    """Password reset link. Returns the reset link for logging."""
    link = f"{APP_URL}/reset-password?token={token}"
    content = f"""
    <h1 style="font-size:24px;font-weight:800;color:#FFF;margin:0 0 12px 0;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;color:#C0C0C0;margin:0 0 8px 0;">
      Hi {name.split(' ')[0] if name else 'there'} &mdash; someone (hopefully you) asked to reset your Luna Group password.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#C0C0C0;margin:0;">
      Tap the button below within the next hour to set a new password.
    </p>
    {_button("Reset Password", link)}
    <p style="font-size:12px;line-height:1.6;color:#6A6A6A;margin:24px 0 0 0;">
      Didn't request this? Ignore this email and your password will stay the same.<br>
      Link: <span style="color:#9A9A9A;word-break:break-all;">{link}</span>
    </p>
    """
    await _send(email, "Reset your Luna Group password", _wrap(content, "Reset link valid for 1 hour."))
    return link


async def send_birthday_reward_email(email: str, name: str, reward_name: str) -> None:
    """Fire-and-forget birthday reward announcement."""
    link = f"{APP_URL}/birthday"
    content = f"""
    <div style="text-align:center;font-size:36px;margin-bottom:8px;">🎉</div>
    <h1 style="font-size:26px;font-weight:800;color:{_BRAND_GOLD};margin:0 0 12px 0;text-align:center;">Happy Birthday, {name.split(' ')[0] if name else 'VIP'}!</h1>
    <p style="font-size:15px;line-height:1.6;color:#C0C0C0;margin:0 0 8px 0;text-align:center;">
      Your birthday week reward is waiting inside the app.
    </p>
    <div style="margin:20px 0;padding:20px;background:#1A1A1A;border-radius:12px;text-align:center;border:1px solid {_BRAND_GOLD}40;">
      <div style="font-size:11px;letter-spacing:2px;color:#6A6A6A;text-transform:uppercase;margin-bottom:6px;">Your reward</div>
      <div style="font-size:18px;font-weight:700;color:#FFF;">{reward_name}</div>
    </div>
    {_button("Claim In App", link)}
    <p style="font-size:12px;line-height:1.6;color:#6A6A6A;margin:16px 0 0 0;text-align:center;">
      Valid for your birthday week only. Show the QR to staff to redeem.
    </p>
    """
    await _send(email, f"🎂 Happy Birthday from Luna Group — your reward is ready", _wrap(content, f"Your birthday reward: {reward_name}."))


async def send_auction_outbid_email(email: str, name: str, auction_title: str, current_bid: float, auction_id: str) -> None:
    """Fire-and-forget outbid notification — drive the user back to re-bid."""
    link = f"{APP_URL}/auctions?id={auction_id}"
    content = f"""
    <div style="text-align:center;font-size:28px;margin-bottom:8px;">⚡</div>
    <h1 style="font-size:22px;font-weight:800;color:#FFF;margin:0 0 8px 0;text-align:center;">You've been outbid</h1>
    <p style="font-size:15px;line-height:1.6;color:#C0C0C0;margin:0 0 16px 0;text-align:center;">
      {name.split(' ')[0] if name else 'Hi'}, someone just placed a higher bid on <strong style="color:#FFF;">{auction_title}</strong>.
    </p>
    <div style="margin:20px 0;padding:20px;background:#1A1A1A;border-radius:12px;text-align:center;border:1px solid #1A1A1A;">
      <div style="font-size:11px;letter-spacing:2px;color:#6A6A6A;text-transform:uppercase;margin-bottom:6px;">Current Bid</div>
      <div style="font-size:28px;font-weight:900;color:{_BRAND_GOLD};">${current_bid:,.0f}</div>
    </div>
    {_button("Place a Higher Bid", link)}
    <p style="font-size:12px;line-height:1.6;color:#6A6A6A;margin:16px 0 0 0;text-align:center;">
      Tip: enable auto-bid so you never miss a winning moment.
    </p>
    """
    await _send(email, f"You've been outbid on {auction_title}", _wrap(content, f"Someone outbid you. Current bid: ${current_bid:,.0f}."))
