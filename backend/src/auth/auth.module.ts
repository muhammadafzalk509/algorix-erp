import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SignupService } from './signup.service';
import { SignupController } from './signup.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, SignupController],
  providers: [AuthService, SignupService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
