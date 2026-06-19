import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  STRONG_PASSWORD,
  STRONG_PASSWORD_MSG,
} from '../../common/validators/strong-password';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  // Department chosen on the login screen; the account must belong to it.
  @IsOptional()
  @IsString()
  department?: string;
}

export class GoogleLoginDto {
  // The ID token (JWT credential) returned by Google Identity Services on the client.
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  // Department chosen on the login screen; the account must belong to it.
  @IsOptional()
  @IsString()
  department?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG })
  newPassword!: string;
}

export class RequestSignupDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG })
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  intro?: string;

  @IsOptional()
  @IsString()
  layer?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  occupation?: string;
}

export class RejectSignupDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG })
  newPassword!: string;
}
