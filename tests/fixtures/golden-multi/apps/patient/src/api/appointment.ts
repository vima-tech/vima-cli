// @vima appointment-patient-fe —— 请求门面 utils/request.ts 包 wx.request 为同签名（A16 骨架契约）
import request from '../utils/request';

export function submitAppointment(data: { patientName: string; date: string }) {
  return request.post('/api/app/appointment', data);
}

export function myAppointments(status?: string) {
  return request.get('/api/app/appointment/mine', { params: { status } });
}
