require "json"

class Box
  def run
    helper
  end

  def helper
    JSON.generate({ ok: true })
  end
end
