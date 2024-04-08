import { MigrationInterface, QueryRunner } from "typeorm";

export class SmartAlbumsFeature1712433249883 implements MigrationInterface {
    name = 'SmartAlbumsFeature1712433249883'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "albums_smart_search" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "libraryId" character varying, "deviceId" character varying, "type" character varying, "isArchived" boolean, "withArchived" boolean, "isEncoded" boolean, "isExternal" boolean, "isFavorite" boolean, "isMotion" boolean, "isOffline" boolean, "isReadOnly" boolean, "isVisible" boolean, "withDeleted" boolean, "withExif" boolean, "createdBefore" TIMESTAMP WITH TIME ZONE, "createdAfter" TIMESTAMP WITH TIME ZONE, "updatedBefore" TIMESTAMP WITH TIME ZONE, "updatedAfter" TIMESTAMP WITH TIME ZONE, "trashedBefore" TIMESTAMP WITH TIME ZONE, "trashedAfter" TIMESTAMP WITH TIME ZONE, "takenBefore" TIMESTAMP WITH TIME ZONE, "takenAfter" TIMESTAMP WITH TIME ZONE, "city" character varying, "state" character varying, "country" character varying, "make" character varying, "model" character varying, "lensModel" character varying, "page" smallint, "size" integer, "isNotInAlbum" boolean, "query" character varying, CONSTRAINT "PK_ff0690b0f69475c6a3913a174c0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "albums_smart_search_persons_person" ("albumSmartSearchId" uuid NOT NULL, "personId" uuid NOT NULL, CONSTRAINT "PK_a8da4a31e272ae061cb64b3acd6" PRIMARY KEY ("albumSmartSearchId", "personId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a8f49d72c5b490e7b0d9530252" ON "albums_smart_search_persons_person" ("albumSmartSearchId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2a6ac7a66536b91e7aa52e3147" ON "albums_smart_search_persons_person" ("personId") `);
        await queryRunner.query(`ALTER TABLE "albums" ADD "smartSearchId" uuid`);
        await queryRunner.query(`ALTER TABLE "albums" ADD CONSTRAINT "UQ_d1d883f20c3da2c1f0998f45b7d" UNIQUE ("smartSearchId")`);
        await queryRunner.query(`ALTER TABLE "albums" ADD CONSTRAINT "FK_d1d883f20c3da2c1f0998f45b7d" FOREIGN KEY ("smartSearchId") REFERENCES "albums_smart_search"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "albums_smart_search_persons_person" ADD CONSTRAINT "FK_a8f49d72c5b490e7b0d95302522" FOREIGN KEY ("albumSmartSearchId") REFERENCES "albums_smart_search"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "albums_smart_search_persons_person" ADD CONSTRAINT "FK_2a6ac7a66536b91e7aa52e3147d" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "albums_smart_search_persons_person" DROP CONSTRAINT "FK_2a6ac7a66536b91e7aa52e3147d"`);
        await queryRunner.query(`ALTER TABLE "albums_smart_search_persons_person" DROP CONSTRAINT "FK_a8f49d72c5b490e7b0d95302522"`);
        await queryRunner.query(`ALTER TABLE "albums" DROP CONSTRAINT "FK_d1d883f20c3da2c1f0998f45b7d"`);
        await queryRunner.query(`ALTER TABLE "albums" DROP CONSTRAINT "UQ_d1d883f20c3da2c1f0998f45b7d"`);
        await queryRunner.query(`ALTER TABLE "albums" DROP COLUMN "smartSearchId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a6ac7a66536b91e7aa52e3147"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a8f49d72c5b490e7b0d9530252"`);
        await queryRunner.query(`DROP TABLE "albums_smart_search_persons_person"`);
        await queryRunner.query(`DROP TABLE "albums_smart_search"`);
    }

}
