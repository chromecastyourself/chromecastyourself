class VideoUploader < CarrierWave::Uploader::Base
  include CarrierWave::RMagick
  storage :file

  def store_dir
    "movies"
  end

  def extension_white_list
    %w(mp4)
  end

  def identifier!
    self.file.identifier
  end
end
