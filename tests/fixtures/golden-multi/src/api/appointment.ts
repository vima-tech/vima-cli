// @vima appointment-admin-fe
import request from '@/utils/request';

export function listAppointments(params: Record<string, unknown>) {
  return request.get('/api/admin/appointment/list', { params });
}

export function auditAppointment(id: number) {
  return request.post('/api/admin/appointment/audit', { id });
}
