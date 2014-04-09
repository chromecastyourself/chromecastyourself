class VideosController < ApplicationController
  def new
    @video = Video.new
  end

  def create
    @video = Video.new video_params

    if @video.save
      Resque.enqueue(VideoConverterJob, @video.id)
      redirect_to @video, flash: { success: 'Success!' }
    else
      render 'new'
    end
  end

  def destroy
    @video = Video.find_by params[:id]
    @video.destroy
    redirect_to new_document_path, flash: { success: 'Success!' }
  end

  def video_params
    params.require(:video).permit(:path)
  end
end
