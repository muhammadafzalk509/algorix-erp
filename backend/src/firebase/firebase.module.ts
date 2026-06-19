import { Global, Module } from '@nestjs/common';
import { FirestoreService } from './firestore.service';

// Global so any module can inject FirestoreService (mirrors PrismaModule).
@Global()
@Module({
  providers: [FirestoreService],
  exports: [FirestoreService],
})
export class FirebaseModule {}
