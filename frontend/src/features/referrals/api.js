// frontend/src/features/referrals/api.js
import api from '../../services/api';

export const getReceivedReferrals = () =>
  api.get('/referrals/received').then((r) => r.data.data.referrals);

export const getSentReferrals = () =>
  api.get('/referrals/sent').then((r) => r.data.data.referrals);

export const requestReferral = (data) =>
  api.post('/referrals/request', data).then((r) => r.data.data.referral);

export const updateReferralStatus = (id, status, note) =>
  api.patch(`/referrals/${id}/status`, { status, ...(note && { note }) }).then((r) => r.data.data);

export const getVerifiedAlumni = () =>
  api.get('/users', { params: { role: 'ALUMNI', verifiedOnly: 'true', limit: 50 } }).then((r) => r.data.data.users);
