import { route } from '../../lib/api.js';
import { currentUser, requireAuth, requirePermission } from '../../middleware/auth.js';
import { distributionService } from './distribution.service.js';
import { beneficiaryInput, collectInput, idParam } from './udhiyya.schema.js';
import { z } from 'zod';

const manage = [requireAuth, requirePermission('udhiyya.manage')];
const collect = [requireAuth, requirePermission('udhiyya.collect')];

route({ method: 'get', path: '/udhiyya/beneficiaries', summary: 'List the poor and needy beneficiary register (udhiyya.manage required)',
  protected: true, middleware: manage }, () => distributionService.beneficiaries());

route({ method: 'post', path: '/udhiyya/beneficiaries', summary: 'Add a beneficiary (udhiyya.manage required)',
  protected: true, status: 201, middleware: manage, body: beneficiaryInput }, input => distributionService.addBeneficiary(input));

route({ method: 'delete', path: '/udhiyya/beneficiaries/:id', summary: 'Remove a beneficiary from the register (udhiyya.manage required)',
  protected: true, middleware: manage }, (_input, req) => distributionService.removeBeneficiary(idParam(req.params.id)));

route({ method: 'post', path: '/udhiyya/cycles/:id/tokens', summary: 'Create meat tokens for paid members and beneficiaries (udhiyya.manage required)',
  protected: true, status: 201, middleware: manage, body: z.strictObject({}) },
(_input, req) => distributionService.generateTokens(idParam(req.params.id)));

route({ method: 'get', path: '/udhiyya/cycles/:id/tokens', summary: 'List meat tokens and delivery needs (udhiyya.manage required)',
  protected: true, middleware: manage }, (_input, req) => distributionService.tokens(idParam(req.params.id)));

route({ method: 'get', path: '/udhiyya/cycles/:id/distribution', summary: 'Live distribution progress (udhiyya.collect required)',
  protected: true, middleware: collect }, (_input, req) => distributionService.progress(idParam(req.params.id)));

route({ method: 'get', path: '/udhiyya/tokens/mine', summary: 'Your meat tokens',
  protected: true, middleware: [requireAuth] }, (_input, req) => distributionService.mine(currentUser(req).id));

route({ method: 'post', path: '/udhiyya/tokens/collect', summary: 'Mark a meat token as collected (udhiyya.collect required)',
  protected: true, middleware: collect, body: collectInput },
(input, req) => distributionService.collect(currentUser(req).id, input.code));
