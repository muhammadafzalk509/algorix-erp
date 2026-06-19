import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isDeveloper, seesAllData } from '../common/tier.util';
import {
  CreateMilestoneDto,
  CreateProjectDto,
  UpdateMilestoneDto,
  UpdateProjectDto,
} from './dto/project.dto';

export interface ProjectDoc {
  id: number;
  clientId: number;
  title: string;
  description?: string | null;
  budget?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status: string;
  createdBy?: number | null;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly fs: FirestoreService) {}

  private async withClient<T extends { clientId: number }>(projects: T[]) {
    const ids = [...new Set(projects.map((p) => p.clientId).filter((x): x is number => x != null))];
    const map = new Map<number, { id: number; name: string }>();
    await Promise.all(
      ids.map(async (id) => {
        const c = await this.fs.findById<{ id: number; name: string }>(COL.clients, id);
        if (c) map.set(id, { id: c.id, name: c.name });
      }),
    );
    return projects.map((p) => ({
      ...p,
      client: p.clientId != null ? map.get(p.clientId) ?? null : null,
    }));
  }

  async findAll(user: AuthUser) {
    let projects: ProjectDoc[];
    if (seesAllData(user.role.permissionTier)) {
      projects = await this.fs.findMany<ProjectDoc>(COL.projects, {
        orderBy: { field: 'id', dir: 'desc' },
      });
    } else {
      const myTasks = await this.fs.findMany<{ projectId: number }>(COL.tasks, {
        where: { assignedTo: user.id },
      });
      const pIds = new Set(myTasks.map((t) => t.projectId));
      const all = await this.fs.findMany<ProjectDoc>(COL.projects, {
        orderBy: { field: 'id', dir: 'desc' },
      });
      projects = all.filter((p) => pIds.has(p.id));
    }
    return this.withClient(projects);
  }

  async findOne(id: number, user: AuthUser) {
    const project = await this.fs.findById<ProjectDoc>(COL.projects, id);
    if (!project) throw new NotFoundException('Project not found.');
    if (isDeveloper(user.role.permissionTier)) {
      const hasTask = await this.fs.findMany(COL.tasks, {
        where: { projectId: id, assignedTo: user.id },
        limit: 1,
      });
      if (!hasTask.length)
        throw new ForbiddenException('You have no tasks in this project.');
    }
    const client =
      project.clientId != null
        ? await this.fs.findById<{ id: number; name: string }>(COL.clients, project.clientId)
        : null;
    const milestones = await this.fs.findMany(COL.milestones, {
      where: { projectId: id },
    });
    milestones.sort((a: any, b: any) => a.id - b.id);
    return {
      ...project,
      client: client ? { id: client.id, name: client.name } : null,
      milestones,
    };
  }

  async create(dto: CreateProjectDto, createdBy: number) {
    const client = await this.fs.findById(COL.clients, dto.clientId);
    if (!client) throw new BadRequestException('Invalid clientId.');
    return this.fs.create<ProjectDoc>(COL.projects, {
      clientId: dto.clientId,
      title: dto.title,
      description: dto.description ?? null,
      budget: dto.budget ?? null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      status: dto.status ?? 'PLANNING',
      createdBy,
    });
  }

  async update(id: number, dto: UpdateProjectDto) {
    await this.ensureExists(id);
    const data: Record<string, unknown> = {};
    if (dto.clientId !== undefined) data.clientId = dto.clientId;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.budget !== undefined) data.budget = dto.budget;
    if (dto.startDate !== undefined)
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    return this.fs.update<ProjectDoc>(COL.projects, id, data);
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.fs.delete(COL.projects, id);
    return { ok: true };
  }

  // ---------- Milestones ----------
  async listMilestones(projectId: number) {
    await this.ensureExists(projectId);
    const milestones = await this.fs.findMany(COL.milestones, {
      where: { projectId },
    });
    milestones.sort((a: any, b: any) => a.id - b.id);
    return milestones;
  }

  async addMilestone(projectId: number, dto: CreateMilestoneDto) {
    await this.ensureExists(projectId);
    return this.fs.create(COL.milestones, {
      projectId,
      name: dto.name,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: dto.status ?? 'PENDING',
      completion: dto.completion ?? 0,
    });
  }

  async updateMilestone(
    projectId: number,
    milestoneId: number,
    dto: UpdateMilestoneDto,
  ) {
    const milestone = await this.fs.findById<{ projectId: number }>(
      COL.milestones,
      milestoneId,
    );
    if (!milestone || milestone.projectId !== projectId)
      throw new NotFoundException('Milestone not found.');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.completion !== undefined) data.completion = dto.completion;
    return this.fs.update(COL.milestones, milestoneId, data);
  }

  private async ensureExists(id: number) {
    const p = await this.fs.findById(COL.projects, id);
    if (!p) throw new NotFoundException('Project not found.');
  }
}
