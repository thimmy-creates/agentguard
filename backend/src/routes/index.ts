import { Router } from 'express';
import * as c from '../controllers';

export const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, service: 'agentguard' }));
api.get('/overview', c.overview);
api.get('/actions', c.actionsCatalog);
api.get('/chain', c.chainStatus);

api.get('/agents', c.agentsList);
api.post('/agents', c.agentsCreate);
api.get('/agents/:id', c.agentsGet);
api.patch('/agents/:id/status', c.agentsStatus);
api.get('/agents/:id/policy', c.policyGet);
api.put('/agents/:id/policy', c.policyPut);

api.post('/gateway/request', c.gatewayRequest);
api.post('/simulate', c.simulate);

api.get('/approvals', c.approvalsList);
api.post('/approvals/:id/approve', c.approve);
api.post('/approvals/:id/reject', c.reject);

api.get('/audit', c.auditList);
api.get('/audit/:id', c.auditGet);
api.get('/audit/:id/verify', c.auditVerify);

api.get('/events', c.eventsList);
api.get('/events/stream', c.eventsStream);
