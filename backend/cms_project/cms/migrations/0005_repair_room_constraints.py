from django.db import migrations


def repair_sqlite_room_constraints(apps, schema_editor):
    if schema_editor.connection.vendor != 'sqlite':
        return

    cursor = schema_editor.connection.cursor()
    table = cursor.execute(
        "select sql from sqlite_master where type='table' and name='cms_room'"
    ).fetchone()
    if not table or '"room_number" varchar(20) NOT NULL UNIQUE' not in table[0]:
        return

    cursor.execute('PRAGMA foreign_keys=OFF')
    cursor.execute('DROP TABLE IF EXISTS cms_room_rebuild')
    cursor.execute(
        """
        CREATE TABLE cms_room_rebuild (
            id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
            room_number varchar(20) NOT NULL,
            building varchar(100) NULL,
            capacity integer NOT NULL,
            type varchar(20) NOT NULL,
            status varchar(20) NOT NULL,
            block_id bigint NULL REFERENCES cms_block(id) DEFERRABLE INITIALLY DEFERRED
        )
        """
    )
    cursor.execute(
        """
        INSERT INTO cms_room_rebuild (id, room_number, building, capacity, type, status, block_id)
        SELECT id, room_number, building, capacity, type, status, block_id
        FROM cms_room
        """
    )
    cursor.execute('DROP TABLE cms_room')
    cursor.execute('ALTER TABLE cms_room_rebuild RENAME TO cms_room')
    cursor.execute('CREATE INDEX IF NOT EXISTS cms_room_block_id_idx ON cms_room(block_id)')
    cursor.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS cms_room_block_id_room_number_uniq '
        'ON cms_room(block_id, room_number)'
    )
    cursor.execute('PRAGMA foreign_keys=ON')


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0004_normalize_room_blocks'),
    ]

    operations = [
        migrations.RunPython(repair_sqlite_room_constraints, migrations.RunPython.noop),
    ]
