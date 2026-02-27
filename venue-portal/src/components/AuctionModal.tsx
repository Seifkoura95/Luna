import React, { useState, useEffect } from 'react';
import { X, Image, DollarSign, Clock, MapPin, FileText, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

interface AuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  auction?: any;
  onSuccess: () => void;
}

const VENUES = [
  { id: 'eclipse', name: 'Eclipse Nightclub' },
  { id: 'after_dark', name: 'After Dark' },
  { id: 'su_casa_brisbane', name: 'Su Casa Brisbane' },
  { id: 'su_casa_gold_coast', name: 'Su Casa Gold Coast' },
];

const CATEGORIES = [
  { id: 'vip_experience', name: 'VIP Experience' },
  { id: 'bottle_service', name: 'Bottle Service' },
  { id: 'meet_greet', name: 'Meet & Greet' },
  { id: 'exclusive_access', name: 'Exclusive Access' },
  { id: 'merchandise', name: 'Merchandise' },
];

export default function AuctionModal({ isOpen, onClose, auction, onSuccess }: AuctionModalProps) {
  const isEditing = !!auction;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    starting_bid: 100,
    min_increment: 10,
    max_bid_limit: 5000,
    duration_hours: 24,
    venue_id: 'eclipse',
    category: 'vip_experience',
    terms: '',
    publish_immediately: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (auction) {
      setFormData({
        title: auction.title || '',
        description: auction.description || '',
        image_url: auction.image_url || '',
        starting_bid: auction.starting_bid || 100,
        min_increment: auction.min_increment || 10,
        max_bid_limit: auction.max_bid_limit || 5000,
        duration_hours: auction.duration_hours || 24,
        venue_id: auction.venue_id || 'eclipse',
        category: auction.category || 'vip_experience',
        terms: auction.terms || '',
        publish_immediately: false,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        image_url: '',
        starting_bid: 100,
        min_increment: 10,
        max_bid_limit: 5000,
        duration_hours: 24,
        venue_id: 'eclipse',
        category: 'vip_experience',
        terms: '',
        publish_immediately: false,
      });
    }
  }, [auction, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isEditing) {
        await api.put(`/venue-admin/auctions/${auction.id}`, formData);
      } else {
        await api.post('/venue-admin/auctions', formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save auction');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!auction) return;
    setLoading(true);
    try {
      await api.post(`/venue-admin/auctions/${auction.id}/publish`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to publish');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!auction) return;
    setLoading(true);
    try {
      await api.post(`/venue-admin/auctions/${auction.id}/unpublish`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to unpublish');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!auction || !confirm('Are you sure you want to delete this auction?')) return;
    setLoading(true);
    try {
      await api.delete(`/venue-admin/auctions/${auction.id}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-heavy rounded-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isEditing ? 'Edit Auction' : 'Create New Auction'}
              </h2>
              {isEditing && (
                <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${
                  auction.status === 'active' ? 'bg-green-500/20 text-green-400' : 
                  auction.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' : 
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {auction.status}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl input-premium text-white"
                placeholder="VIP Booth Experience"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl input-premium text-white min-h-[100px] resize-none"
                placeholder="Describe the auction item..."
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <Image className="w-4 h-4 inline mr-1" />
                Image URL
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full px-4 py-3 rounded-xl input-premium text-white"
                placeholder="https://..."
              />
              {formData.image_url && (
                <img 
                  src={formData.image_url} 
                  alt="Preview" 
                  className="mt-2 w-full h-32 object-cover rounded-lg"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              )}
            </div>

            {/* Venue & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Venue
                </label>
                <select
                  value={formData.venue_id}
                  onChange={(e) => setFormData({ ...formData, venue_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl input-premium text-white"
                >
                  {VENUES.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl input-premium text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Starting Bid
                </label>
                <input
                  type="number"
                  value={formData.starting_bid}
                  onChange={(e) => setFormData({ ...formData, starting_bid: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl input-premium text-white"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Min Increment</label>
                <input
                  type="number"
                  value={formData.min_increment}
                  onChange={(e) => setFormData({ ...formData, min_increment: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl input-premium text-white"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Max Limit</label>
                <input
                  type="number"
                  value={formData.max_bid_limit}
                  onChange={(e) => setFormData({ ...formData, max_bid_limit: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl input-premium text-white"
                  min="1"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Duration (hours)
              </label>
              <input
                type="number"
                value={formData.duration_hours}
                onChange={(e) => setFormData({ ...formData, duration_hours: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl input-premium text-white"
                min="1"
                max="168"
              />
            </div>

            {/* Terms */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Terms & Conditions
              </label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="w-full px-4 py-3 rounded-xl input-premium text-white min-h-[80px] resize-none"
                placeholder="Optional terms..."
              />
            </div>

            {/* Publish Immediately */}
            {!isEditing && (
              <label className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-[#E31837]/30 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.publish_immediately}
                  onChange={(e) => setFormData({ ...formData, publish_immediately: e.target.checked })}
                  className="w-5 h-5 rounded accent-[#E31837]"
                />
                <div>
                  <p className="text-white font-medium">Publish Immediately</p>
                  <p className="text-sm text-gray-400">Make auction live right after creation</p>
                </div>
              </label>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex gap-2">
                {isEditing && (
                  <>
                    {auction.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Publish
                      </button>
                    ) : auction.status === 'active' && auction.total_bids === 0 ? (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-medium transition-colors"
                      >
                        <EyeOff className="w-4 h-4" />
                        Unpublish
                      </button>
                    ) : null}
                    {(auction.status === 'draft' || auction.total_bids === 0) && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-medium transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 border border-white/20 hover:bg-white/5 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 btn-primary text-white rounded-xl font-bold"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
