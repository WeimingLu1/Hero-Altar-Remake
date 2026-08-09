# frozen_string_literal: true
# Converts the RPG Maker XP map graph into browser-readable JSON without
# modifying the original project. Run from the repository root:
# ruby scripts/extract_rxdata.rb
require "json"
require "fileutils"
require "time"

module RPG
  class Map; end
  class MapInfo; end
  class AudioFile; end
  class Tileset; end
  class Event
    class Page
      class Condition; end
      class Graphic; end
    end
  end
  class EventCommand; end
  class MoveRoute; end
  class MoveCommand; end
end

class Table
  attr_reader :dimensions, :xsize, :ysize, :zsize, :data
  def self._load(raw)
    table = allocate
    dimensions, xsize, ysize, zsize, count = raw.unpack("L<5")
    table.instance_variable_set(:@dimensions, dimensions)
    table.instance_variable_set(:@xsize, xsize)
    table.instance_variable_set(:@ysize, ysize)
    table.instance_variable_set(:@zsize, zsize)
    table.instance_variable_set(:@data, raw.byteslice(20, count * 2).unpack("s<*"))
    table
  end
end

def text(value)
  value.to_s.dup.force_encoding("UTF-8").scrub
end

def ivar(object, name, fallback = nil)
  object.instance_variable_get("@#{name}") || fallback
end

def command_json(command)
  {
    code: ivar(command, :code, 0),
    indent: ivar(command, :indent, 0),
    parameters: json_value(ivar(command, :parameters, []))
  }
end

def json_value(value)
  case value
  when String then text(value)
  when Numeric, TrueClass, FalseClass, NilClass then value
  when Array then value.map { |item| json_value(item) }
  when Hash then value.to_h { |key, item| [text(key), json_value(item)] }
  when Table then { x: value.xsize, y: value.ysize, z: value.zsize, data: value.data }
  else
    value.instance_variables.to_h { |name| [name.to_s.delete_prefix("@"), json_value(value.instance_variable_get(name))] }
  end
end

repo_root = File.expand_path("..", __dir__)
source_root = File.join(repo_root, "reference", "rpgmaker")
data_dir = File.join(source_root, "Data")
out_dir = File.join(__dir__, "..", "game-data")
FileUtils.mkdir_p(out_dir)
infos = Marshal.load(File.binread(File.join(data_dir, "MapInfos.rxdata")))

maps = infos.keys.sort.map do |id|
  map = Marshal.load(File.binread(File.join(data_dir, format("Map%03d.rxdata", id))))
  events = ivar(map, :events, {}).values.map do |event|
    {
      id: ivar(event, :id), name: text(ivar(event, :name)), x: ivar(event, :x), y: ivar(event, :y),
      pages: ivar(event, :pages, []).map do |page|
        {
          condition: json_value(ivar(page, :condition)), graphic: json_value(ivar(page, :graphic)),
          move_type: ivar(page, :move_type), move_speed: ivar(page, :move_speed),
          move_frequency: ivar(page, :move_frequency), move_route: json_value(ivar(page, :move_route)),
          walk_anime: ivar(page, :walk_anime), step_anime: ivar(page, :step_anime),
          direction_fix: ivar(page, :direction_fix), through: ivar(page, :through),
          always_on_top: ivar(page, :always_on_top), trigger: ivar(page, :trigger),
          commands: ivar(page, :list, []).map { |command| command_json(command) }
        }
      end
    }
  end
  table = ivar(map, :data)
  {
    id: id, name: text(ivar(infos[id], :name)), parent_id: ivar(infos[id], :parent_id, 0),
    width: ivar(map, :width), height: ivar(map, :height), tileset_id: ivar(map, :tileset_id),
    autoplay_bgm: ivar(map, :autoplay_bgm), bgm: json_value(ivar(map, :bgm)),
    autoplay_bgs: ivar(map, :autoplay_bgs), bgs: json_value(ivar(map, :bgs)),
    encounter_list: ivar(map, :encounter_list, []), encounter_step: ivar(map, :encounter_step),
    tiles: { x: table.xsize, y: table.ysize, z: table.zsize, data: table.data }, events: events
  }
end

manifest = {
  format: "rmxp-hero-map-export", version: 1,
  source_commit: File.read(File.join(source_root, "SOURCE_COMMIT")).strip,
  generated_at: Time.now.utc.iso8601, map_count: maps.length, maps: maps
}

# Stable output: build metadata lives in a sibling report, game data remains diffable.
File.write(File.join(out_dir, "maps.json"), JSON.generate(manifest.reject { |key, _| key == :generated_at }))
File.write(File.join(out_dir, "extraction-report.json"), JSON.pretty_generate(manifest.slice(:format, :version, :source_commit, :generated_at, :map_count)))
tilesets = Marshal.load(File.binread(File.join(data_dir, "Tilesets.rxdata"))).compact.map do |tileset|
  {
    id: ivar(tileset, :id), name: text(ivar(tileset, :name)), tileset_name: text(ivar(tileset, :tileset_name)),
    autotile_names: ivar(tileset, :autotile_names, []).map { |name| text(name) },
    panorama_name: text(ivar(tileset, :panorama_name)), battleback_name: text(ivar(tileset, :battleback_name)),
    passages: json_value(ivar(tileset, :passages)), priorities: json_value(ivar(tileset, :priorities)),
    terrain_tags: json_value(ivar(tileset, :terrain_tags))
  }
end
File.write(File.join(out_dir, "tilesets.json"), JSON.generate({ format: "rmxp-hero-tilesets", version: 1, data: tilesets }))
puts "Exported #{maps.length} maps to #{out_dir}"
