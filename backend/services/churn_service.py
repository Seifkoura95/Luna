"""
Advanced Churn Prediction Automation Service
Uses AI to analyze user behavior and trigger win-back campaigns.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from bson import ObjectId

from database import db
from services.ai_service import luna_ai

logger = logging.getLogger(__name__)


class ChurnPredictionService:
    """
    Advanced churn prediction and win-back automation.
    
    Features:
    - Behavioral analysis (visit frequency, spend patterns, engagement)
    - AI-powered risk scoring using Claude
    - Automated win-back campaigns with personalized offers
    - Cohort analysis for targeted retention
    """
    
    # Risk thresholds
    HIGH_RISK_DAYS_INACTIVE = 45
    MEDIUM_RISK_DAYS_INACTIVE = 21
    ENGAGEMENT_DROP_THRESHOLD = 0.5  # 50% drop in activity
    
    # Win-back offer configurations
    WIN_BACK_OFFERS = {
        "high": [
            {"type": "vip_upgrade", "value": "1 month free VIP", "points": 500},
            {"type": "free_entry", "value": "Free entry + drink", "points": 0},
            {"type": "exclusive_event", "value": "VIP event invitation", "points": 0},
        ],
        "medium": [
            {"type": "bonus_points", "value": "2x points this week", "points": 250},
            {"type": "discount", "value": "25% off next visit", "points": 100},
        ],
        "low": [
            {"type": "reminder", "value": "Miss you message", "points": 50},
        ]
    }
    
    async def analyze_user_churn_risk(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze individual user's churn risk with detailed metrics.
        """
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            return {"error": "User not found"}
        
        # Calculate behavioral metrics
        metrics = await self._calculate_user_metrics(user)
        
        # Get AI risk analysis
        ai_analysis = await self._get_ai_churn_analysis(user, metrics)
        
        # Calculate final risk score (0-100)
        risk_score = self._calculate_risk_score(metrics, ai_analysis)
        
        # Determine risk level
        if risk_score >= 70:
            risk_level = "high"
        elif risk_score >= 40:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "user_id": user_id,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "metrics": metrics,
            "ai_insights": ai_analysis.get("insights"),
            "recommended_action": ai_analysis.get("recommended_action"),
            "win_back_offer": self._select_win_back_offer(risk_level),
            "analyzed_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def _calculate_user_metrics(self, user: dict) -> Dict[str, Any]:
        """Calculate behavioral metrics for churn prediction."""
        user_id = user.get("user_id")
        now = datetime.now(timezone.utc)
        
        # Days since last visit
        last_visit = user.get("last_visit_date")
        if isinstance(last_visit, str):
            try:
                last_visit = datetime.fromisoformat(last_visit.replace('Z', '+00:00'))
            except:
                last_visit = None
        
        days_inactive = (now - last_visit).days if last_visit else 999
        
        # Visit frequency (last 90 days)
        ninety_days_ago = now - timedelta(days=90)
        recent_visits = await db.check_ins.count_documents({
            "user_id": user_id,
            "check_in_time": {"$gte": ninety_days_ago}
        })
        
        # Previous 90 days visits (for comparison)
        prev_period_start = ninety_days_ago - timedelta(days=90)
        prev_visits = await db.check_ins.count_documents({
            "user_id": user_id,
            "check_in_time": {"$gte": prev_period_start, "$lt": ninety_days_ago}
        })
        
        # Engagement change
        engagement_change = 0
        if prev_visits > 0:
            engagement_change = (recent_visits - prev_visits) / prev_visits
        
        # Spend analysis
        recent_spend = await db.payment_transactions.aggregate([
            {"$match": {
                "user_id": user_id,
                "created_at": {"$gte": ninety_days_ago},
                "payment_status": "paid"
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        total_recent_spend = recent_spend[0]["total"] if recent_spend else 0
        
        # Points activity
        points_balance = user.get("points_balance", 0)
        lifetime_points = user.get("lifetime_points_earned", 0)
        
        # Auction participation
        recent_bids = await db.bids.count_documents({
            "user_id": user_id,
            "timestamp": {"$gte": ninety_days_ago}
        })
        
        return {
            "days_inactive": days_inactive,
            "recent_visits_90d": recent_visits,
            "previous_visits_90d": prev_visits,
            "engagement_change": round(engagement_change, 2),
            "recent_spend_90d": total_recent_spend,
            "points_balance": points_balance,
            "lifetime_points": lifetime_points,
            "recent_bids": recent_bids,
            "tier": user.get("tier", "bronze"),
            "subscription_status": user.get("subscription", {}).get("status", "none"),
            "has_active_subscription": user.get("subscription", {}).get("status") == "active"
        }
    
    async def _get_ai_churn_analysis(self, user: dict, metrics: dict) -> Dict[str, Any]:
        """Get AI-powered churn analysis and recommendations."""
        try:
            analysis = await luna_ai.analyze_churn_risk({
                "total_visits": metrics.get("recent_visits_90d", 0) + metrics.get("previous_visits_90d", 0),
                "points": metrics.get("points_balance", 0),
                "tier": metrics.get("tier", "bronze"),
                "favorite_venue": user.get("favorite_venue"),
                "last_visit_date": user.get("last_visit_date")
            })
            
            return {
                "risk_level": analysis.get("risk_level", "medium"),
                "insights": analysis.get("win_back_message"),
                "recommended_action": analysis.get("recommended_action", "bonus_points")
            }
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return {
                "risk_level": "medium",
                "insights": None,
                "recommended_action": "bonus_points"
            }
    
    def _calculate_risk_score(self, metrics: dict, ai_analysis: dict) -> int:
        """Calculate composite risk score (0-100)."""
        score = 0
        
        # Inactivity score (max 40 points)
        days_inactive = metrics.get("days_inactive", 0)
        if days_inactive > 60:
            score += 40
        elif days_inactive > 45:
            score += 30
        elif days_inactive > 21:
            score += 20
        elif days_inactive > 14:
            score += 10
        
        # Engagement decline score (max 25 points)
        engagement_change = metrics.get("engagement_change", 0)
        if engagement_change < -0.75:
            score += 25
        elif engagement_change < -0.5:
            score += 20
        elif engagement_change < -0.25:
            score += 10
        
        # Spend decline (max 15 points)
        if metrics.get("recent_spend_90d", 0) == 0 and metrics.get("recent_visits_90d", 0) > 0:
            score += 15
        
        # Points hoarding without redemption (max 10 points)
        if metrics.get("points_balance", 0) > 5000 and metrics.get("days_inactive", 0) > 30:
            score += 10
        
        # AI risk adjustment (max 10 points)
        ai_risk = ai_analysis.get("risk_level", "medium")
        if ai_risk == "high":
            score += 10
        elif ai_risk == "medium":
            score += 5
        
        # Subscription lapse protection
        if metrics.get("has_active_subscription"):
            score = max(0, score - 15)  # Subscribers get risk reduction
        
        return min(100, max(0, score))
    
    def _select_win_back_offer(self, risk_level: str) -> Dict[str, Any]:
        """Select appropriate win-back offer based on risk level."""
        import random
        offers = self.WIN_BACK_OFFERS.get(risk_level, self.WIN_BACK_OFFERS["low"])
        return random.choice(offers)
    
    async def run_batch_analysis(self, limit: int = 100) -> Dict[str, Any]:
        """
        Run batch churn analysis on users.
        Returns summary statistics and high-risk users.
        """
        logger.info(f"Starting batch churn analysis (limit: {limit})")
        
        # Get users who haven't been analyzed recently
        users = await db.users.find({
            "$or": [
                {"churn_analyzed_at": {"$exists": False}},
                {"churn_analyzed_at": {"$lt": datetime.now(timezone.utc) - timedelta(days=7)}}
            ]
        }).limit(limit).to_list(limit)
        
        results = {
            "analyzed_count": 0,
            "high_risk": [],
            "medium_risk": [],
            "low_risk": [],
            "errors": []
        }
        
        for user in users:
            try:
                user_id = user.get("user_id")
                analysis = await self.analyze_user_churn_risk(user_id)
                
                # Store analysis result
                await db.users.update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "churn_risk_score": analysis.get("risk_score"),
                            "churn_risk_level": analysis.get("risk_level"),
                            "churn_analyzed_at": datetime.now(timezone.utc)
                        }
                    }
                )
                
                # Categorize
                risk_level = analysis.get("risk_level")
                user_summary = {
                    "user_id": user_id,
                    "email": user.get("email"),
                    "risk_score": analysis.get("risk_score"),
                    "win_back_offer": analysis.get("win_back_offer")
                }
                
                if risk_level == "high":
                    results["high_risk"].append(user_summary)
                elif risk_level == "medium":
                    results["medium_risk"].append(user_summary)
                else:
                    results["low_risk"].append(user_summary)
                
                results["analyzed_count"] += 1
                
            except Exception as e:
                logger.error(f"Error analyzing user {user.get('user_id')}: {e}")
                results["errors"].append(str(e))
        
        logger.info(f"Batch analysis complete: {results['analyzed_count']} users analyzed, "
                   f"{len(results['high_risk'])} high risk, {len(results['medium_risk'])} medium risk")
        
        return results
    
    async def trigger_win_back_campaign(self, user_id: str, offer: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Trigger a win-back campaign for a specific user.
        """
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            return {"error": "User not found"}
        
        # Get offer if not provided
        if not offer:
            analysis = await self.analyze_user_churn_risk(user_id)
            offer = analysis.get("win_back_offer")
        
        # Create win-back record
        campaign = {
            "user_id": user_id,
            "offer_type": offer.get("type"),
            "offer_value": offer.get("value"),
            "bonus_points": offer.get("points", 0),
            "status": "sent",
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
        }
        
        result = await db.win_back_campaigns.insert_one(campaign)
        
        # Award bonus points if applicable
        if offer.get("points", 0) > 0:
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$inc": {"points_balance": offer["points"]},
                    "$push": {
                        "points_history": {
                            "amount": offer["points"],
                            "type": "win_back_bonus",
                            "description": f"Welcome back gift: {offer['value']}",
                            "date": datetime.now(timezone.utc)
                        }
                    }
                }
            )
        
        # Create notification
        notification = {
            "user_id": user_id,
            "type": "win_back",
            "title": "We miss you!",
            "message": f"Here's a special gift just for you: {offer['value']}",
            "data": {"offer": offer, "campaign_id": str(result.inserted_id)},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
        
        logger.info(f"Win-back campaign triggered for user {user_id}: {offer['type']}")
        
        return {
            "success": True,
            "campaign_id": str(result.inserted_id),
            "offer": offer,
            "notification_sent": True
        }
    
    async def get_churn_dashboard_stats(self) -> Dict[str, Any]:
        """Get churn statistics for dashboard."""
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        # Risk distribution
        high_risk_count = await db.users.count_documents({"churn_risk_level": "high"})
        medium_risk_count = await db.users.count_documents({"churn_risk_level": "medium"})
        low_risk_count = await db.users.count_documents({"churn_risk_level": "low"})
        
        # Recent win-back campaigns
        recent_campaigns = await db.win_back_campaigns.count_documents({
            "created_at": {"$gte": week_ago}
        })
        
        # Churned users (inactive 60+ days)
        churned = await db.users.count_documents({
            "last_visit_date": {"$lt": now - timedelta(days=60)}
        })
        
        # Reactivated users (came back after win-back)
        reactivated = await db.win_back_campaigns.count_documents({
            "status": "converted",
            "created_at": {"$gte": month_ago}
        })
        
        return {
            "risk_distribution": {
                "high": high_risk_count,
                "medium": medium_risk_count,
                "low": low_risk_count
            },
            "total_at_risk": high_risk_count + medium_risk_count,
            "churned_60d": churned,
            "recent_campaigns_7d": recent_campaigns,
            "reactivated_30d": reactivated,
            "updated_at": now.isoformat()
        }


# Singleton instance
churn_service = ChurnPredictionService()
