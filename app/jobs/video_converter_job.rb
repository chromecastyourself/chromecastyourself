class VideoConverterJob
  @queue = :default

  def self.perform(id)
    video = Video.find id
    FFMPEG::Movie.new(video.path.path).screenshot("#{Rails.root}/public/thumbs/#{video.path.identifier!.split('.').first}_thumb.jpg", seek_time: 5)
    FFMPEG::Movie.new(video.path.path).transcode("#{Rails.root}/public/movies/#{video.path.identifier!.split('.').first}.mp4") do |progress|
      puts progress
      if(progress == 1.0)
        File.delete("#{Rails.root}/public/movies/#{video.path.identifier!}")
      end
    end
    video.path = "#{video.path.split('.').first}.mp4"
    video.save
  end
end
