from django.db import migrations


BLOCK_ALIASES = {
    's': 'S-Block',
    's block': 'S-Block',
    's-block': 'S-Block',
    'p': 'P-Block',
    'p block': 'P-Block',
    'p-block': 'P-Block',
    'n': 'N-Block',
    'n block': 'N-Block',
    'n-block': 'N-Block',
    'e': 'E-Block',
    'e block': 'E-Block',
    'e-block': 'E-Block',
}


def normalize_room_block_aliases(apps, schema_editor):
    Block = apps.get_model('cms', 'Block')
    Room = apps.get_model('cms', 'Room')

    canonical_blocks = {}
    for canonical in sorted(set(BLOCK_ALIASES.values())):
        canonical_blocks[canonical], _ = Block.objects.get_or_create(
            code=canonical,
            defaults={'name': canonical},
        )

    for block in list(Block.objects.all()):
        canonical_name = BLOCK_ALIASES.get(str(block.code or block.name or '').strip().lower())
        if not canonical_name:
            canonical_name = BLOCK_ALIASES.get(str(block.name or '').strip().lower())
        if not canonical_name:
            continue

        canonical_block = canonical_blocks[canonical_name]
        if block.id == canonical_block.id:
            block.code = canonical_name
            block.name = canonical_name
            block.save(update_fields=['code', 'name'])
            continue

        for room in Room.objects.filter(block=block):
            duplicate = Room.objects.filter(
                block=canonical_block,
                room_number__iexact=room.room_number,
            ).exclude(id=room.id).exists()
            if duplicate:
                continue
            room.block = canonical_block
            room.building = canonical_block.name
            room.save(update_fields=['block', 'building'])

        if not Room.objects.filter(block=block).exists():
            block.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0013_import_legacy_rooms'),
    ]

    operations = [
        migrations.RunPython(normalize_room_block_aliases, migrations.RunPython.noop),
    ]
