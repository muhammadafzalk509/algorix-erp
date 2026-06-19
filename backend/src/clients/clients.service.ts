import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly fs: FirestoreService) {}

  findAll() {
    return this.fs.findMany(COL.clients, { orderBy: { field: 'id', dir: 'desc' } });
  }

  async findOne(id: number) {
    const client = await this.fs.findById<any>(COL.clients, id);
    if (!client) throw new NotFoundException('Client not found.');
    const projects = await this.fs.findMany(COL.projects, { where: { clientId: id } });
    return { ...client, projects };
  }

  create(dto: CreateClientDto, createdBy: number) {
    return this.fs.create(COL.clients, {
      ...dto,
      email: dto.email.toLowerCase(),
      currency: dto.currency ?? 'USD',
      createdBy,
    });
  }

  async update(id: number, dto: UpdateClientDto) {
    await this.ensureExists(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    return this.fs.update(COL.clients, id, data);
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.fs.delete(COL.clients, id);
    return { ok: true };
  }

  private async ensureExists(id: number) {
    const c = await this.fs.findById(COL.clients, id);
    if (!c) throw new NotFoundException('Client not found.');
  }
}
