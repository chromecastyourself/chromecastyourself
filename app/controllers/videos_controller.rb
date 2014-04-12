class VideosController < ApplicationController
  def index
    @videos = Video.all
  end

  def new
    @video = Video.new
  end

  def create
    @video = Video.new video_params

    if @video.save
      FFMPEG::Movie.new(@video.path.path).screenshot("#{Rails.root}/public/thumbs/#{@video.path.identifier!.split('.').first}_thumb.jpg", seek_time: 5)
      # Resque.enqueue(VideoConverterJob, @video.id)
      redirect_to videos_path, flash: { success: 'Success!' }
    else
      render 'new'
    end
  end

  def destroy
    @video = Video.find_by params[:id]
    @video.destroy
    redirect_to videos_path, flash: { success: 'Success!' }
  end

  def video_params
    params.require(:video).permit(:path)
  end
end
