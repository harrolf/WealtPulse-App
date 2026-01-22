import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings


async def migrate_data():
    source_user_id = 1  # admin@wealthpulse.com / initial seed user
    target_user_id = 3  # harrolf@gmail.com

    engine = create_async_engine(settings.DATABASE_URL)

    tables_to_update = [
        "assets",
        "custodians",
        "asset_types",
        "primary_groups",
        "tags",
        "webauthn_credentials",
        "oauth_accounts",
    ]

    async with engine.begin() as conn:
        print(f"Migrating data from User {source_user_id} to User {target_user_id}...")

        for table in tables_to_update:
            # Check if source has data
            result = await conn.execute(
                text(f"SELECT COUNT(*) FROM {table} WHERE user_id = :source_id"),
                {"source_id": source_user_id},
            )
            count = result.scalar()

            if count > 0:
                print(f"Moving {count} records in '{table}'...")
                # Update user_id
                # Note: This primitive migration assumes no unique constraint conflicts on user_id + other_field
                # Since target user is empty, this should be fine.
                await conn.execute(
                    text(
                        f"UPDATE {table} SET user_id = :target_id WHERE user_id = :source_id"
                    ),
                    {"target_id": target_user_id, "source_id": source_user_id},
                )
            else:
                print(f"No records in '{table}' to migrate.")

        # Also handle user_shares where source might be owner or viewer
        # 1. As Owner
        await conn.execute(
            text(
                "UPDATE user_shares SET owner_id = :target_id WHERE owner_id = :source_id"
            ),
            {"target_id": target_user_id, "source_id": source_user_id},
        )
        # 2. As Viewer
        await conn.execute(
            text(
                "UPDATE user_shares SET viewer_id = :target_id WHERE viewer_id = :source_id"
            ),
            {"target_id": target_user_id, "source_id": source_user_id},
        )
        print("Updated User Shares.")

        # Copy settings if target settings are empty
        # For simplicity, we'll just overwrite target settings with source settings if source has them
        # fetching source settings string
        result = await conn.execute(
            text("SELECT settings FROM users WHERE id = :source_id"),
            {"source_id": source_user_id},
        )
        source_settings = result.scalar()

        if source_settings:
            print("Migrating settings...")
            await conn.execute(
                text("UPDATE users SET settings = :settings WHERE id = :target_id"),
                {"settings": source_settings, "target_id": target_user_id},
            )

    print("Migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate_data())
