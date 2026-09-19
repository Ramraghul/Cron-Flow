import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthRepository {
    constructor(private readonly prisma: PrismaService) {}

    findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } });
    }

    findUserById(id: string): Promise<Pick<User, 'id' | 'email'> | null> {
        return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    }

    createUser(email: string, passwordHash: string): Promise<User> {
        return this.prisma.user.create({ data: { email, password: passwordHash } });
    }
}
