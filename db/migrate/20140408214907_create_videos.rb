class CreateVideos < ActiveRecord::Migration
  def change
    create_table :videos do |t|
      t.string :path

      t.timestamps
    end
  end
end
