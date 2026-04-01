"""
Scheduled Jobs for Luna Group VIP App
Includes churn analysis cron job and push notification dispatcher.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from database import db
from services.churn_service import churn_service
from services.notification_ws_manager import notification_ws_manager
from services.ai_service import luna_ai
from routes.shared import send_push_notification_to_token

logger = logging.getLogger(__name__)


class ScheduledJobsManager:
    """Manages scheduled background jobs."""
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.is_running = False
    
    def start(self):
        """Start the scheduler with all jobs."""
        if self.scheduler:
            return
        
        self.scheduler = AsyncIOScheduler()
        
        # Churn analysis - Daily at 3 AM
        self.scheduler.add_job(
            self.run_daily_churn_analysis,
            CronTrigger(hour=3, minute=0),
            id="daily_churn_analysis",
            name="Daily Churn Analysis",
            replace_existing=True
        )
        
        # Win-back campaign dispatch - Every 4 hours
        self.scheduler.add_job(
            self.dispatch_win_back_campaigns,
            IntervalTrigger(hours=4),
            id="win_back_dispatch",
            name="Win-back Campaign Dispatch",
            replace_existing=True
        )
        
        # Auction ending notifications - Every 5 minutes
        self.scheduler.add_job(
            self.send_auction_ending_notifications,
            IntervalTrigger(minutes=5),
            id="auction_ending_notifications",
            name="Auction Ending Notifications",
            replace_existing=True
        )
        
        # Event reminders - Every 15 minutes
        self.scheduler.add_job(
            self.send_event_reminders,
            IntervalTrigger(minutes=15),
            id="event_reminders",
            name="Event Reminders",
            replace_existing=True
        )
        
        # Wallet pass expiry reminders - Every 2 hours
        self.scheduler.add_job(
            self.send_wallet_pass_expiry_reminders,
            IntervalTrigger(hours=2),
            id="wallet_pass_expiry_reminders",
            name="Wallet Pass Expiry Reminders",
            replace_existing=True
        )
        
        self.scheduler.start()
        self.is_running = True
        logger.info("Scheduled jobs manager started")
    
    def stop(self):
        """Stop the scheduler."""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            self.is_running = False
            logger.info("Scheduled jobs manager stopped")
    
    async def run_daily_churn_analysis(self):
        """
        Daily churn analysis job.
        Analyzes all users who haven't been analyzed in the last 7 days.
        """
        logger.info("Starting daily churn analysis job...")
        
        try:
            # Run batch analysis for up to 500 users
            results = await churn_service.run_batch_analysis(limit=500)
            
            logger.info(
                f"Churn analysis complete: {results['analyzed_count']} users analyzed, "
                f"{len(results['high_risk'])} high risk, {len(results['medium_risk'])} medium risk"
            )
            
            # Store job run record
            await db.scheduled_job_runs.insert_one({
                "job_name": "daily_churn_analysis",
                "started_at": datetime.now(timezone.utc),
                "completed_at": datetime.now(timezone.utc),
                "status": "completed",
                "results": {
                    "analyzed_count": results["analyzed_count"],
                    "high_risk_count": len(results["high_risk"]),
                    "medium_risk_count": len(results["medium_risk"]),
                    "low_risk_count": len(results["low_risk"]),
                    "errors": len(results["errors"])
                }
            })
            
            return results
            
        except Exception as e:
            logger.error(f"Churn analysis job failed: {e}")
            await db.scheduled_job_runs.insert_one({
                "job_name": "daily_churn_analysis",
                "started_at": datetime.now(timezone.utc),
                "completed_at": datetime.now(timezone.utc),
                "status": "failed",
                "error": str(e)
            })
    
    async def dispatch_win_back_campaigns(self):
        """
        Dispatch win-back push notifications for high-risk users.
        Targets users who haven't received a win-back in the last 14 days.
        """
        logger.info("Starting win-back campaign dispatch...")
        
        try:
            fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
            
            # Find high-risk users without recent win-back campaigns
            high_risk_users = await db.users.find({
                "churn_risk_level": "high",
                "$or": [
                    {"last_win_back_sent": {"$exists": False}},
                    {"last_win_back_sent": {"$lt": fourteen_days_ago}}
                ]
            }).limit(50).to_list(50)
            
            campaigns_sent = 0
            push_sent = 0
            ws_sent = 0
            
            for user in high_risk_users:
                user_id = user.get("user_id")
                
                try:
                    # Trigger win-back campaign
                    result = await churn_service.trigger_win_back_campaign(user_id)
                    
                    if result.get("success"):
                        campaigns_sent += 1
                        offer = result.get("offer", {})
                        
                        # Send WebSocket notification if online
                        if notification_ws_manager.is_user_online(user_id):
                            ws_result = await notification_ws_manager.send_win_back_notification(
                                user_id, offer
                            )
                            if ws_result:
                                ws_sent += 1
                        
                        # Send push notification
                        push_result = await send_win_back_push_notification(user, offer)
                        if push_result:
                            push_sent += 1
                        
                        # Update last win-back sent timestamp
                        await db.users.update_one(
                            {"user_id": user_id},
                            {"$set": {"last_win_back_sent": datetime.now(timezone.utc)}}
                        )
                        
                except Exception as e:
                    logger.error(f"Win-back dispatch error for {user_id}: {e}")
            
            logger.info(
                f"Win-back dispatch complete: {campaigns_sent} campaigns, "
                f"{push_sent} push notifications, {ws_sent} WebSocket notifications"
            )
            
            await db.scheduled_job_runs.insert_one({
                "job_name": "win_back_dispatch",
                "started_at": datetime.now(timezone.utc),
                "completed_at": datetime.now(timezone.utc),
                "status": "completed",
                "results": {
                    "campaigns_sent": campaigns_sent,
                    "push_sent": push_sent,
                    "ws_sent": ws_sent
                }
            })
            
        except Exception as e:
            logger.error(f"Win-back dispatch job failed: {e}")
    
    async def send_auction_ending_notifications(self):
        """
        Send notifications for auctions ending soon.
        Targets auctions ending in the next 15 minutes.
        """
        try:
            now = datetime.now(timezone.utc)
            fifteen_minutes = now + timedelta(minutes=15)
            
            # Find auctions ending soon
            ending_auctions = await db.auctions.find({
                "status": "active",
                "end_time": {"$gte": now, "$lte": fifteen_minutes},
                "ending_notification_sent": {"$ne": True}
            }).to_list(20)
            
            for auction in ending_auctions:
                auction_id = auction.get("id")
                
                # Get users who have bid on this auction
                bidders = await db.bids.distinct("user_id", {"auction_id": auction_id})
                
                for user_id in bidders:
                    # Send WebSocket notification
                    if notification_ws_manager.is_user_online(user_id):
                        await notification_ws_manager.send_to_user(user_id, {
                            "type": "auction_ending",
                            "title": "Auction ending soon!",
                            "message": f"{auction.get('title')} ends in 15 minutes!",
                            "data": {"auction_id": auction_id}
                        })
                
                # Mark notification as sent
                await db.auctions.update_one(
                    {"id": auction_id},
                    {"$set": {"ending_notification_sent": True}}
                )
                
        except Exception as e:
            logger.error(f"Auction ending notifications error: {e}")
    
    async def send_event_reminders(self):
        """
        Send reminders for events starting soon.
        Targets events starting in the next hour.
        """
        try:
            now = datetime.now(timezone.utc)
            one_hour = now + timedelta(hours=1)
            
            # Find events starting soon with interested users
            # This would need an "event_interests" or "rsvp" collection
            # For now, we'll check users with recent activity at the venue
            
            upcoming_events = await db.events.find({
                "start_time": {"$gte": now, "$lte": one_hour},
                "reminder_sent": {"$ne": True}
            }).to_list(10)
            
            for event in upcoming_events:
                event_id = event.get("id")
                venue_id = event.get("venue_id")
                
                # Find users who frequent this venue
                recent_visitors = await db.check_ins.distinct("user_id", {
                    "venue_id": venue_id,
                    "check_in_time": {"$gte": now - timedelta(days=30)}
                })
                
                for user_id in recent_visitors[:50]:  # Limit to 50 users
                    if notification_ws_manager.is_user_online(user_id):
                        await notification_ws_manager.send_event_reminder(
                            user_id=user_id,
                            event_id=event_id,
                            event_title=event.get("title", "Event"),
                            venue_name=event.get("venue_name", "Luna venue"),
                            starts_in="1 hour"
                        )
                
                # Mark reminder as sent
                await db.events.update_one(
                    {"id": event_id},
                    {"$set": {"reminder_sent": True}}
                )
                
        except Exception as e:
            logger.error(f"Event reminders error: {e}")
    
    async def send_new_auction_alerts(self):
        """
        Send push notifications for new auctions at favorite venues.
        Runs every hour to notify users of fresh auction opportunities.
        """
        try:
            now = datetime.now(timezone.utc)
            one_hour_ago = now - timedelta(hours=1)
            
            # Find recently created auctions
            new_auctions = await db.auctions.find({
                "status": "active",
                "start_time": {"$gte": one_hour_ago},
                "new_auction_notification_sent": {"$ne": True}
            }).to_list(20)
            
            notifications_sent = 0
            
            for auction in new_auctions:
                auction_id = auction.get("id")
                venue_id = auction.get("venue_id")
                
                # Find users who have favorited this venue or visited recently
                potential_users = set()
                
                # Users who favorited the venue
                favorites = await db.user_favorites.find({"venue_id": venue_id}).to_list(100)
                for fav in favorites:
                    potential_users.add(fav.get("user_id"))
                
                # Users who visited this venue in last 30 days
                recent_visitors = await db.check_ins.distinct("user_id", {
                    "venue_id": venue_id,
                    "check_in_time": {"$gte": now - timedelta(days=30)}
                })
                potential_users.update(recent_visitors[:50])
                
                # Users subscribed to auction updates for this venue
                subscribers = await db.auction_subscribers.find({
                    "$or": [
                        {"venue_id": venue_id},
                        {"auction_type": auction.get("auction_type")}
                    ]
                }).to_list(100)
                for sub in subscribers:
                    potential_users.add(sub.get("user_id"))
                
                for user_id in potential_users:
                    # Check user's notification preferences
                    prefs = await db.notification_preferences.find_one({"user_id": user_id})
                    if prefs and not prefs.get("auction_updates", True):
                        continue
                    
                    # Send WebSocket notification if online
                    if notification_ws_manager.is_user_online(user_id):
                        await notification_ws_manager.send_to_user(user_id, {
                            "type": "new_auction",
                            "title": "New VIP Experience!",
                            "message": f"🔥 {auction.get('title')} just launched at {auction.get('venue_name')}!",
                            "data": {
                                "auction_id": auction_id,
                                "venue_id": venue_id,
                                "starting_bid": auction.get("starting_bid")
                            }
                        })
                    
                    # Send push notification
                    user = await db.users.find_one({"user_id": user_id})
                    if user and user.get("push_tokens"):
                        for token in user.get("push_tokens", []):
                            try:
                                await send_push_notification_to_token(
                                    token=token,
                                    title="🔥 New Auction Live!",
                                    body=f"{auction.get('title')} at {auction.get('venue_name')} - Starting at ${auction.get('starting_bid')}!",
                                    data={
                                        "type": "new_auction",
                                        "auction_id": auction_id,
                                        "venue_id": venue_id
                                    }
                                )
                                notifications_sent += 1
                            except Exception as e:
                                logger.error(f"New auction push notification failed: {e}")
                
                # Mark notification as sent for this auction
                await db.auctions.update_one(
                    {"id": auction_id},
                    {"$set": {"new_auction_notification_sent": True}}
                )
            
            if notifications_sent > 0:
                logger.info(f"Sent {notifications_sent} new auction notifications")
            
        except Exception as e:
            logger.error(f"New auction alerts error: {e}")
    
    async def send_auction_won_notification(self, auction_id: str):
        """
        Send notification when an auction ends and winner is determined.
        Called when auction status changes to 'completed'.
        """
        try:
            auction = await db.auctions.find_one({"id": auction_id})
            if not auction or not auction.get("winner_id"):
                return
            
            winner_id = auction.get("winner_id")
            winner = await db.users.find_one({"user_id": winner_id})
            
            if not winner:
                return
            
            # Create in-app notification
            await db.notifications.insert_one({
                "id": str(uuid.uuid4())[:8],
                "user_id": winner_id,
                "type": "auction_won",
                "title": "🎉 Congratulations! You Won!",
                "message": f"You won {auction.get('title')} at {auction.get('venue_name')} for ${auction.get('current_bid')}!",
                "data": {
                    "auction_id": auction_id,
                    "winning_bid": auction.get("current_bid"),
                    "venue_id": auction.get("venue_id")
                },
                "priority": "high",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            # Send WebSocket notification
            if notification_ws_manager.is_user_online(winner_id):
                await notification_ws_manager.send_to_user(winner_id, {
                    "type": "auction_won",
                    "title": "🎉 Congratulations! You Won!",
                    "message": f"You won {auction.get('title')} for ${auction.get('current_bid')}!",
                    "data": {
                        "auction_id": auction_id,
                        "winning_bid": auction.get("current_bid")
                    }
                })
            
            # Send push notification
            if winner.get("push_tokens"):
                for token in winner.get("push_tokens", []):
                    try:
                        await send_push_notification_to_token(
                            token=token,
                            title="🎉 You Won the Auction!",
                            body=f"Congratulations! You won {auction.get('title')} for ${auction.get('current_bid')}. Complete payment to confirm.",
                            data={
                                "type": "auction_won",
                                "auction_id": auction_id,
                                "winning_bid": auction.get("current_bid")
                            }
                        )
                    except Exception as e:
                        logger.error(f"Auction won push notification failed: {e}")
            
            logger.info(f"Sent auction won notification to {winner_id} for auction {auction_id}")
            
        except Exception as e:
            logger.error(f"Auction won notification error: {e}")


async def send_win_back_push_notification(user: dict, offer: dict) -> bool:
    """
    Send push notification for win-back campaign.
    """
    from routes.shared import send_push_notification_to_token
    
    push_tokens = user.get("push_tokens", [])
    if not push_tokens:
        return False
    
    # Generate AI-powered message
    try:
        ai_message = await luna_ai.generate_auction_nudge(
            auction_title=f"Welcome back gift: {offer.get('value', 'Special offer')}",
            current_bid=0,
            user_last_bid=0,
            time_remaining="7 days"
        )
        message = ai_message if ai_message else f"We miss you! Claim your gift: {offer.get('value')}"
    except:
        message = f"We miss you! Here's a special gift: {offer.get('value', 'Special offer')}"
    
    success = False
    for token in push_tokens:
        try:
            await send_push_notification_to_token(
                token=token,
                title="We miss you! 🎉",
                body=message,
                data={
                    "type": "win_back",
                    "offer_type": offer.get("type"),
                    "offer_value": offer.get("value")
                }
            )
            success = True
        except Exception as e:
            logger.error(f"Push notification failed: {e}")
    
    return success


# Global instance
scheduled_jobs = ScheduledJobsManager()


# Add the wallet pass expiry reminder method to the class
async def _send_wallet_pass_expiry_reminders_impl():
    """
    Send push notifications for wallet passes expiring in the next 24 hours.
    Runs every 2 hours to remind users of expiring rewards.
    """
    logger.info("Starting wallet pass expiry reminder check...")
    
    try:
        now = datetime.now(timezone.utc)
        reminder_window_start = now + timedelta(hours=20)  # 20-28 hours from now
        reminder_window_end = now + timedelta(hours=28)
        
        # Find passes expiring soon that haven't been reminded yet
        expiring_passes = await db.wallet_passes.find({
            "status": "active",
            "redeemed": False,
            "expires_at": {
                "$gte": reminder_window_start,
                "$lte": reminder_window_end
            },
            "expiry_reminder_sent": {"$ne": True}
        }).to_list(100)
        
        reminders_sent = 0
        
        for wallet_pass in expiring_passes:
            user_id = wallet_pass.get("user_id")
            pass_title = wallet_pass.get("title", "Reward")
            pass_id = wallet_pass.get("id")
            
            # Get user for push token
            user = await db.users.find_one({"user_id": user_id})
            if not user or not user.get("push_tokens"):
                continue
            
            # Calculate hours until expiry
            expires_at = wallet_pass.get("expires_at")
            if isinstance(expires_at, datetime):
                hours_left = int((expires_at - now).total_seconds() / 3600)
            else:
                hours_left = 24
            
            # Send push notification
            for token in user.get("push_tokens", []):
                try:
                    await send_push_notification_to_token(
                        token=token,
                        title="⏰ Reward Expiring Soon!",
                        body=f"Your {pass_title} expires in ~{hours_left} hours. Use it before it's gone!",
                        data={
                            "type": "wallet_pass_expiry",
                            "pass_id": pass_id,
                            "screen": "wallet"
                        }
                    )
                    reminders_sent += 1
                except Exception as e:
                    logger.error(f"Expiry reminder push failed: {e}")
            
            # Mark as reminded
            await db.wallet_passes.update_one(
                {"id": pass_id},
                {"$set": {"expiry_reminder_sent": True}}
            )
            
            # Also create in-app notification
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "wallet_pass_expiry",
                "title": "Reward Expiring Soon",
                "message": f"Your {pass_title} expires in ~{hours_left} hours!",
                "data": {"pass_id": pass_id},
                "read": False,
                "created_at": now
            })
        
        logger.info(f"Wallet pass expiry check complete: {reminders_sent} reminders sent for {len(expiring_passes)} expiring passes")
        
        # Store job run record
        await db.scheduled_job_runs.insert_one({
            "job_name": "wallet_pass_expiry_reminders",
            "completed_at": now,
            "status": "completed",
            "results": {
                "passes_checked": len(expiring_passes),
                "reminders_sent": reminders_sent
            }
        })
        
    except Exception as e:
        logger.error(f"Wallet pass expiry reminder job failed: {e}")


# Monkey-patch the method onto the class
ScheduledJobsManager.send_wallet_pass_expiry_reminders = lambda self: _send_wallet_pass_expiry_reminders_impl()
