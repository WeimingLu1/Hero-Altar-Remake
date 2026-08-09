# frozen_string_literal: true
# Extracts the project's compressed, CRC-protected custom databases to JSON.
require "json"
require "zlib"
require "fileutils"
require "time"

module RPG
  %w[AudioFile System Text Kungfu Skill Item Weapon Armor Enemy Task].each do |name|
    const_set(name, Class.new) unless const_defined?(name, false)
  end
  System.const_set(:Words, Class.new) unless System.const_defined?(:Words, false)
  System.const_set(:TestBattler, Class.new) unless System.const_defined?(:TestBattler, false)
  Enemy.const_set(:Action, Class.new) unless Enemy.const_defined?(:Action, false)
end

class Table
  attr_reader :dimensions, :xsize, :ysize, :zsize, :data
  def self._load(raw)
    value = allocate
    dimensions, xsize, ysize, zsize, count = raw.unpack("L<5")
    value.instance_variable_set(:@dimensions, dimensions)
    value.instance_variable_set(:@xsize, xsize)
    value.instance_variable_set(:@ysize, ysize)
    value.instance_variable_set(:@zsize, zsize)
    value.instance_variable_set(:@data, raw.byteslice(20, count * 2).unpack("s<*"))
    value
  end
end

def utf8(value)
  value.to_s.dup.force_encoding("UTF-8").scrub
end

def jsonify(value, seen = {})
  case value
  when String then utf8(value)
  when Symbol then value.to_s
  when Integer, Float, TrueClass, FalseClass, NilClass then value
  when Array then value.map { |item| jsonify(item, seen) }
  when Hash
    value.each_with_object({}) { |(key, item), result| result[utf8(key)] = jsonify(item, seen) }
  when Table
    { "$type" => "Table", "x" => value.xsize, "y" => value.ysize, "z" => value.zsize, "data" => value.data }
  else
    oid = value.object_id
    return { "$ref" => seen[oid] } if seen.key?(oid)
    ref = "#{value.class.name}:#{seen.length + 1}"
    seen[oid] = ref
    data = { "$type" => value.class.name }
    value.instance_variables.each do |name|
      data[name.to_s.delete_prefix("@")] = jsonify(value.instance_variable_get(name), seen)
    end
    data
  end
end

def read_database(path)
  File.open(path, "rb") do |file|
    payloads = Marshal.load(file)
    checksums = Marshal.load(file)
    payloads = [payloads] unless payloads.is_a?(Array)
    checksums = [checksums] unless checksums.is_a?(Array)
    payloads.each_with_index.map do |payload, index|
      crc = checksums[index]
      raise "CRC mismatch: #{path}" unless crc == Zlib.crc32(payload, 9527)
      Marshal.load(Zlib::Inflate.inflate(payload))
    end
  end
end

def read_raw_stream(path)
  File.open(path, "rb") do |file|
    values = []
    values << Marshal.load(file) until file.eof?
    values
  end
end

repo_root = File.expand_path("..", __dir__)
source = File.join(repo_root, "reference", "rpgmaker", "Data")
output = File.expand_path("../game-data", __dir__)
FileUtils.mkdir_p(output)

files = {
  core: "GmudCore.dat", kungfus: "GmudKungfu.dat", skills: "GmudSkill.dat",
  items: "GmudItem.dat", weapons: "GmudWeapon.dat", armors: "GmudArmor.dat",
  enemies: "GmudEnemy.dat", enemies_plus: "GmudEnemyPlus.dat", tasks: "GmudTask.dat"
}

counts = {}
files.each do |key, filename|
  path = File.join(source, filename)
  packets = read_database(path)
  value = packets.length == 1 ? packets.first : packets
  json = jsonify(value)
  File.write(File.join(output, "#{key}.json"), JSON.generate({ format: "rmxp-hero-data", version: 1, kind: key, data: json }))
  counts[key] = value.respond_to?(:length) ? value.length : 1
end

config = read_raw_stream(File.join(source, "GmudConfig.dat"))
File.write(File.join(output, "config.json"), JSON.generate({ format: "rmxp-hero-data", version: 1, kind: :config, data: jsonify(config) }))
counts[:config] = config.length

report = { format: "rmxp-hero-data-report", version: 1, generated_at: Time.now.utc.iso8601, files: counts }
File.write(File.join(output, "database-report.json"), JSON.pretty_generate(report))
puts JSON.pretty_generate(report)
